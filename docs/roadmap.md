# Project roadmap

This is the scope and launch checklist for **DeviceBench V1**. All three readiness
tools, their local dashboard, CLI, reports, and setup documentation belong to this
first public release. `0.2.0` identifies the current development package; it does
not describe a separate customer release.

The V1 promise is: **check your local AI setup, understand model requirements,
test the app features you need, and keep a report of what happened.** Recorded
validation and pending work are kept separate in the [release record](readiness-release.md).

## Implemented locally

| Track | Available now | Main boundary |
| --- | --- | --- |
| Local AI Doctor | Runtime/inventory checks, hardware information, reported allocation, optional log diagnosis | Missing probes remain unknown |
| Model & Context Checker | Metadata, declared context checks, conservative memory estimates | Selected dense architectures only; estimates are not measured fit |
| App Compatibility Tester | Streaming, JSON, tools, and embeddings probes; editable app presets | Small API probes; successful real tool/embedding models need verification |
| Local companion | Three tools, setup help, next-step guidance, results matched to active settings, HTML/JSON downloads | Loopback only; browser reports clear on reload; up to 16 temporary server reports |
| Benchmark runner | Ollama and RunAnywhere adapters, prompt suites, repeat/warm-up controls, evidence export/import | Limited workload and platform validation |
| Website and documentation | React product website, illustrative report, setup instructions, bundled documentation | Does not run inference or inspect visitors' hardware |
| Packaging and CI | Local wheel/source build, install check, cross-platform CI configuration | Publication and cross-platform execution remain pending |
| CPU research | Pinned llama.cpp patch, correctness fixtures, paired experiments, text demo | Opt-in; tuned whole-model speed target unmet |

## V1 launch checklist

The release owner should record evidence for each item before advertising it as
complete. These are V1 completion tasks, not a new feature release.

1. **Validate the customer journey.** From a clean environment, install the exact
   release artifact, connect a runtime, run all three tools, and download/open
   both report formats. Check unavailable runtimes, empty inventories, unsupported
   features, keyboard use, and narrow screens as well as the successful path.
2. **Confirm the advertised platform scope.** Execute the configured CI and test
   supported hardware/runtime combinations on real devices. Windows/macOS remain
   unvalidated until that evidence exists; a Linux-first launch must say so.
3. **Complete live feature coverage.** Retain successful streaming, JSON,
   tool-calling, and embedding results with model/runtime identities. Successful
   real tool-call and embedding models are still pending; fixtures alone do not
   establish model compatibility.
4. **Prepare public distribution.** Select the application license, choose the
   public repository/download destination and contact path, build the final wheel
   and source archive, verify installation, and record their hashes. Replace
   preview wording and installation placeholders only when the release exists.
5. **Try V1 with target developers.** Observe a few users installing it and
   answering a real integration question. Resolve blocking confusion, record known
   limitations, and publish the agreed artifact with its setup and support scope.

No public release is recorded yet. Source changes, a local wheel, configured CI,
and a passing fixture suite each provide different evidence.

## Deferred benchmark work

- Add acceptance suites that represent a real app, with clearly defined pass criteria.
- Make cache/residency conditions repeatable and improve environmental evidence,
  including accelerator placement and thermal conditions.
- Collect larger run counts under documented conditions.
- Extend adapters when an identified target device or integration requires them.

Benchmark controls and workload-qualification improvements are deferred while V1
is completed. Existing CLI measurements remain available as an advanced workflow.
These ideas follow the [original product research gates](research.md#next-gates);
they are not conditions for using the three readiness tools.

## Independent research track

Keep the Q4_K candidate opt-in. The isolated kernel gain has not translated into
a consistent improvement over the tuned eight-core whole-model baseline. Repeat
the constrained-core observation on a quiet host, use natural workloads, test
additional models, and reproduce on another device. A repeatable whole-model
gain precedes any performance-product claim or engine integration/distribution work.
See the [experiment protocol](engine-experiment.md#protocol).

## Outside V1

Authenticated or remote inference endpoints, arbitrary API base paths,
AMD/Intel/Metal memory telemetry, unsupported-architecture sizing, and mobile
runtime integration are outside the current release scope. Accounts, hosted
benchmark execution, team management, and cloud report storage are not implemented
or committed roadmap features.

## Keeping this plan current

Update this guide when scope or a release gate changes. Put reproducible validation
results in the appropriate evidence document, and update the support matrix and
user guide when a capability changes. `TODO.json` is currently an unused empty
tracker; it is not evidence that the roadmap is complete. The website bundles
these guides directly so its documentation reflects the source at build time.
