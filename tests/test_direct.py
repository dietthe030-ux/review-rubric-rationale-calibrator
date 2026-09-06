import json
import sys

import pytest


def rubric():
    return json.dumps({
        "dimensions": [{
            "id": "clarity",
            "min": 0,
            "max": 2,
            "anchors": [
                {"score": 0, "text": "Unclear"},
                {"score": 1, "text": "Partly clear"},
                {"score": 2, "text": "Clear and specific"},
            ],
        }],
    })


@pytest.mark.direct
def test_direct_runtime_storage_authority_and_history(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/main.py")
    loaded = sys.modules[contract.__class__.__module__]
    alice = loaded.Address(direct_alice)
    bob = loaded.Address(direct_bob)
    charlie = loaded.Address(direct_charlie)
    direct_vm.sender = alice
    case_id = contract.create_rubric("a" * 32, bob, rubric(), 0)
    assert int(case_id) == 1
    assert int(contract.get_count()) == 1
    assert json.loads(contract.get_version(1, 1))["phase"] == "BASE_DRAFT"

    direct_vm.sender = charlie
    with pytest.raises(Exception):
        contract.lock_rubric(1, 1)
    assert json.loads(contract.get_case(1))["revision"] == "1"

    direct_vm.sender = alice
    contract.lock_rubric(1, 1)
    locked = json.loads(contract.get_version(1, 2))
    assert locked["phase"] == "BASE_LOCKED"
    assert locked["last_operation"]["caller"] == str(alice).lower()


@pytest.mark.direct
def test_direct_runtime_consensus_and_readback(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    contract = direct_deploy("contracts/main.py")
    loaded = sys.modules[contract.__class__.__module__]
    alice = loaded.Address(direct_alice)
    bob = loaded.Address(direct_bob)
    evaluator = loaded.Address(direct_charlie)
    direct_vm.sender = alice
    contract.create_rubric("b" * 32, bob, rubric(), 0)
    contract.lock_rubric(1, 1)
    direct_vm.sender = bob
    contract.put_review(1, json.dumps({
        "reviews": [{
            "dimension_id": "clarity",
            "score": 2,
            "rationale": "The explanation is clear and specific, matching the score-two anchor.",
        }],
    }), 2)
    contract.freeze_review(1, 3)
    direct_vm.mock_llm(".*", '{"v":1,"labels":["SUPPORTS_SELECTED"]}')
    direct_vm.sender = evaluator
    contract.calibrate_review(1, 4)
    final = json.loads(contract.get_version(1, 5))
    assert final["phase"] == "DONE"
    assert final["outcome"] == "CALIBRATED"
    assert final["accepted_attempts"] == 1
