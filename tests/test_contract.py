import importlib.util
import json
from pathlib import Path
import sys
import types

import pytest


class U256(int):
    pass


class Address:
    def __init__(self, value):
        self.value = value.lower()

    def __str__(self):
        return self.value


class TreeMap(dict):
    @classmethod
    def __class_getitem__(cls, _item):
        return cls


class UserError(Exception):
    pass


def decorator(function):
    return function


class Public:
    view = staticmethod(decorator)
    write = staticmethod(decorator)


OWNER = Address("0x" + "11" * 20)
REVIEWER = Address("0x" + "22" * 20)
OTHER = Address("0x" + "33" * 20)


@pytest.fixture(scope="module")
def contract_module():
    genlayer = types.ModuleType("genlayer")
    gl = types.SimpleNamespace(
        Contract=object,
        public=Public(),
        vm=types.SimpleNamespace(
            UserError=UserError,
            Return=type("Return", (), {}),
            run_nondet_unsafe=lambda leader, _validator: leader(),
        ),
        message=types.SimpleNamespace(sender_address=OWNER),
        nondet=types.SimpleNamespace(exec_prompt=lambda *_args, **_kwargs: None),
    )
    genlayer.__all__ = ["gl", "u256", "Address", "TreeMap"]
    genlayer.gl = gl
    genlayer.u256 = U256
    genlayer.Address = Address
    genlayer.TreeMap = TreeMap
    prior = sys.modules.get("genlayer")
    sys.modules["genlayer"] = genlayer
    try:
        path = Path(__file__).parents[1] / "contracts" / "main.py"
        spec = importlib.util.spec_from_file_location("calibrator_contract", path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        yield module
    finally:
        if prior is None:
            sys.modules.pop("genlayer", None)
        else:
            sys.modules["genlayer"] = prior


@pytest.fixture
def instance(contract_module):
    value = contract_module.ReviewRubricRationaleCalibrator()
    value.cases = TreeMap()
    value.nonce_index = TreeMap()
    value.actor_index = TreeMap()
    value.child_index = TreeMap()
    value.version_index = TreeMap()
    value.history = TreeMap()
    value.__init__()
    contract_module.gl.message.sender_address = OWNER
    return value


def base(low=0, high=2):
    return {
        "dimensions": [
            {
                "id": "clarity",
                "min": low,
                "max": high,
                "anchors": [
                    {"score": score, "text": f"Anchor {score}"}
                    for score in range(low, high + 1)
                ],
            }
        ]
    }


def response(score=1):
    return {
        "reviews": [
            {
                "dimension_id": "clarity",
                "score": score,
                "rationale": "The explanation is specific and follows the selected anchor.",
            }
        ]
    }


def test_anchor_interval_and_bool_boundaries(contract_module):
    assert contract_module._validate_base(base(0, 10))
    with pytest.raises(UserError):
        contract_module._validate_base(base(0, 11))
    missing = base()
    missing["dimensions"][0]["anchors"].pop(1)
    with pytest.raises(UserError):
        contract_module._validate_base(missing)
    boolean = base()
    boolean["dimensions"][0]["min"] = False
    with pytest.raises(UserError):
        contract_module._validate_base(boolean)


def test_duplicate_json_keys_and_review_order_fail_closed(contract_module):
    with pytest.raises(UserError):
        contract_module._parse('{"dimensions":[],"dimensions":[]}', 8192)
    with pytest.raises(UserError):
        contract_module._validate_response(
            {"reviews": [{"dimension_id": "wrong", "score": 1, "rationale": "Reason"}]},
            base(),
        )


@pytest.mark.parametrize(
    "labels,expected",
    [
        (["SUPPORTS_SELECTED"], ("DONE", "CALIBRATED")),
        (["MISSING_ANCHOR_REASON"], ("DONE", "ANCHOR_MISSING")),
        (["SUPPORTS_OTHER"], ("DONE", "RATIONALE_SCORE_CONFLICT")),
        (["UNKNOWN"], ("UNRESOLVED", "UNRESOLVED")),
        (["UNKNOWN", "SUPPORTS_OTHER"], ("UNRESOLVED", "UNRESOLVED")),
    ],
)
def test_reducer_precedence(contract_module, labels, expected):
    assert contract_module._reduce(labels) == expected


def test_result_schema_is_exact(contract_module):
    assert contract_module._validate_result({"v": 1, "labels": ["SUPPORTS_SELECTED"]}, 1)
    for bad in (
        {"v": True, "labels": ["SUPPORTS_SELECTED"]},
        {"v": 1, "labels": []},
        {"v": 1, "labels": ["CALIBRATED"]},
        {"v": 1, "labels": ["SUPPORTS_SELECTED"], "reason": "extra"},
    ):
        with pytest.raises(UserError):
            contract_module._validate_result(bad, 1)


def test_create_replay_and_nonce_conflict(contract_module, instance):
    payload = json.dumps(base())
    created = instance.create_rubric("a" * 32, REVIEWER, payload, U256(0))
    assert created == 1
    assert instance.create_rubric("a" * 32, REVIEWER, payload, U256(0)) == 1
    assert instance.get_count() == 1
    assert json.loads(instance.get_case(U256(1)))["revision"] == "1"
    with pytest.raises(UserError):
        instance.create_rubric("a" * 32, REVIEWER, json.dumps(base(-1, 1)), U256(0))


def test_authority_phase_cas_and_history(contract_module, instance):
    instance.create_rubric("b" * 32, REVIEWER, json.dumps(base()), U256(0))
    contract_module.gl.message.sender_address = OTHER
    with pytest.raises(UserError):
        instance.lock_rubric(U256(1), U256(1))
    contract_module.gl.message.sender_address = OWNER
    with pytest.raises(UserError):
        instance.lock_rubric(U256(1), U256(2))
    instance.lock_rubric(U256(1), U256(1))
    locked = json.loads(instance.get_version(U256(1), U256(2)))
    assert locked["phase"] == "BASE_LOCKED"
    assert locked["base_locked"] is True
    contract_module.gl.message.sender_address = REVIEWER
    instance.put_review(U256(1), json.dumps(response()), U256(2))
    instance.freeze_review(U256(1), U256(3))
    frozen = json.loads(instance.get_version(U256(1), U256(4)))
    assert frozen["phase"] == "FROZEN"
    assert frozen["response_locked"] is True


def test_consensus_outcomes_and_exact_operation_readback(contract_module, instance):
    instance.create_rubric("c" * 32, REVIEWER, json.dumps(base()), U256(0))
    instance.lock_rubric(U256(1), U256(1))
    contract_module.gl.message.sender_address = REVIEWER
    instance.put_review(U256(1), json.dumps(response()), U256(2))
    instance.freeze_review(U256(1), U256(3))
    contract_module.gl.message.sender_address = OTHER
    contract_module.gl.nondet.exec_prompt = lambda *_args, **_kwargs: {
        "v": 1,
        "labels": ["SUPPORTS_SELECTED"],
    }
    instance.calibrate_review(U256(1), U256(4))
    final = json.loads(instance.get_version(U256(1), U256(5)))
    assert final["phase"] == "DONE"
    assert final["outcome"] == "CALIBRATED"
    assert final["accepted_attempts"] == 1
    assert final["last_operation"]["method"] == "calibrate_review"


def test_model_failure_preserves_every_map(contract_module, instance):
    instance.create_rubric("f" * 32, REVIEWER, json.dumps(base()), U256(0))
    instance.lock_rubric(U256(1), U256(1))
    contract_module.gl.message.sender_address = REVIEWER
    instance.put_review(U256(1), json.dumps(response()), U256(2))
    instance.freeze_review(U256(1), U256(3))
    before = {
        name: dict(getattr(instance, name))
        for name in (
            "cases", "nonce_index", "actor_index", "child_index", "version_index", "history"
        )
    }
    contract_module.gl.nondet.exec_prompt = lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("model unavailable"))
    with pytest.raises(RuntimeError):
        instance.calibrate_review(U256(1), U256(4))
    assert before == {name: dict(getattr(instance, name)) for name in before}


def test_unknown_commits_unresolved_and_enforces_cooldown(contract_module, instance):
    instance.create_rubric("1" * 32, REVIEWER, json.dumps(base()), U256(0))
    instance.lock_rubric(U256(1), U256(1))
    contract_module.gl.message.sender_address = REVIEWER
    instance.put_review(U256(1), json.dumps(response()), U256(2))
    instance.freeze_review(U256(1), U256(3))
    contract_module.gl.nondet.exec_prompt = lambda *_args, **_kwargs: {"v": 1, "labels": ["UNKNOWN"]}
    instance.calibrate_review(U256(1), U256(4))
    unresolved = json.loads(instance.get_case(U256(1)))
    assert unresolved["phase"] == "UNRESOLVED"
    assert unresolved["accepted_attempts"] == 1
    with pytest.raises(UserError):
        instance.retry_review(U256(1), U256(5))


def test_parent_requires_terminal_same_parties(contract_module, instance):
    instance.create_rubric("d" * 32, REVIEWER, json.dumps(base()), U256(0))
    with pytest.raises(UserError):
        instance.create_rubric("e" * 32, REVIEWER, json.dumps(base()), U256(1))


def test_schema_inventory_matches_stage_2():
    schema = json.loads((Path(__file__).parents[1] / "contract-schema.json").read_text())
    assert schema["ctor"]["params"] == []
    assert set(schema["methods"]) == {
        "get_case", "get_version", "get_id_by_nonce", "get_count", "list_cases",
        "list_actor", "list_children", "create_rubric", "replace_rubric", "lock_rubric",
        "put_review", "freeze_review", "calibrate_review", "retry_review",
    }
    assert sum(not method["readonly"] for method in schema["methods"].values()) == 7
    assert sum(method["readonly"] for method in schema["methods"].values()) == 7
