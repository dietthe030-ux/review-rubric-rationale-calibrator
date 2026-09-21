# Release Verification

## Release identity

- Application code-bearing revision: `9fb6fc921858e50e8014c159aa499d417caa86d5`
- Application code-bearing tree: `8da99688da109179423474cd66ac2c8f3d6957bd`
- Contract source SHA-256: `09A239AC767BDBD34BC86E71D09087C8D330FF577D52454065A47D6E39E69FB1`
- Live application: https://review-rubric-rationale-calibrator.vercel.app
- Studio Next contract: [`0x939b18947EA1125668eD622c4f49c77167AAA4a5`](https://explorer-studio-dev.genlayer.com/address/0x939b18947EA1125668eD622c4f49c77167AAA4a5)
- Deployment transaction: [`0x87cd13fcaef7e2cc627f6a2adbc98819e06c47716ce457d4849236530c7c0e5c`](https://explorer-studio-dev.genlayer.com/tx/0x87cd13fcaef7e2cc627f6a2adbc98819e06c47716ce457d4849236530c7c0e5c)
- Network: GenLayer Studio Next, chain `61997`
- Deployment model: intentionally frozen; no upgrader or linked contract

`gen_getContractCode` returned 18,128 bytes whose SHA-256 matched the source above. The live schema exposes zero constructor parameters and 14 public methods: 7 views and 7 writes.

## Automated verification

| Check | Command | Result |
|---|---|---|
| Contract behavior | `python -m pytest -q -p no:cacheprovider` | 17 passed |
| Contract syntax | `python -m py_compile contracts/main.py` | passed |
| Contract lint/schema | `genvm-lint check contracts/main.py --json` | passed; informational I200 only |
| Frontend regression | `npm --prefix frontend test -- --run` | 26 passed |
| Production build | `npm --prefix frontend run build` | passed; disclosed bundle-size warning only |
| Frontend RPC evidence | see [`RPC-BUDGET.md`](RPC-BUDGET.md) | passed within every locked ceiling |

## Live proof matrix

The final Chrome journey used an external OKX Wallet account, not the Studio deployer. Case `2` advanced from creation through a locked rubric, frozen review and validator calibration. The final authoritative readback was revision `5`, phase `DONE`, outcome `CALIBRATED`, public verdict `SUPPORTS_SELECTED`, accepted attempts `1`.

| Public action | Transaction | Verified consequence |
|---|---|---|
| Create rubric | [`0xcbe5369e3840ddf449ed3de4daf6e3eb0b2c45ba4ae56aa66023658c7412175c`](https://explorer-studio-dev.genlayer.com/tx/0xcbe5369e3840ddf449ed3de4daf6e3eb0b2c45ba4ae56aa66023658c7412175c) | case `2`, revision `1` |
| Lock rubric | [`0x28a4024ee43af5cb7e5f46a25acf30de6add71abe5a091824581661cb3381619`](https://explorer-studio-dev.genlayer.com/tx/0x28a4024ee43af5cb7e5f46a25acf30de6add71abe5a091824581661cb3381619) | immutable rubric, revision `2` |
| Submit review | [`0x3bafa7ad3b3501e15c6338db765ca7026de2ac185fa50e48de7b2f4f16eefd7f`](https://explorer-studio-dev.genlayer.com/tx/0x3bafa7ad3b3501e15c6338db765ca7026de2ac185fa50e48de7b2f4f16eefd7f) | bounded score/rationale stored, revision `3` |
| Freeze review | [`0xfd68bf958e5b27b1f3b0ed195ea899776645f929976d14f15a09ddf8079898db`](https://explorer-studio-dev.genlayer.com/tx/0xfd68bf958e5b27b1f3b0ed195ea899776645f929976d14f15a09ddf8079898db) | review sealed, revision `4` |
| Calibrate rationale | [`0x95106ca942009b4696369772046a18005d1310bc760512a1353a08898d4e33eb`](https://explorer-studio-dev.genlayer.com/tx/0x95106ca942009b4696369772046a18005d1310bc760512a1353a08898d4e33eb) | `DONE / CALIBRATED / SUPPORTS_SELECTED`, revision `5` |

Every transaction reached `FINALIZED`, reported semantic success and matched the method-specific readback before the interface displayed success. The last write also proved delayed-finality recovery: the interface advanced automatically from waiting to `SUCCESS` and marked the durable journal entry `VERIFIED` without a duplicate submission.

## Browser and wallet checks

- A full reload starts disconnected and requires explicit wallet selection.
- The chooser rendered only the detected supported provider, OKX Wallet; it did not mislabel it as MetaMask.
- Owner-to-reviewer account changes synchronized the active session and write client.
- The five terminal journal records survived reload.
- Empty reviewer input failed before a wallet request or journal mutation.
- The chooser closed with Escape and returned focus without requesting an account.
- Public read-only case lookup remained available while disconnected.

## Known limitations

- Submitted rubric and review text is public and permanent; users must not submit private information.
- Calibration checks consistency between the rationale and the selected anchor. It does not establish objective truth, submission quality, reviewer competence or fairness.
- The contract is intentionally frozen. A material contract defect requires a new deployment.
- Wallet availability depends on an installed MetaMask, OKX Wallet or Rabby provider, and network availability depends on Studio Next.
