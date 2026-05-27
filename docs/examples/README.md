# /run request examples

One JSON file per registered language. Pipe any of them to a running goboxd:

```
curl -sS -X POST http://localhost:8080/run \
  -H 'Content-Type: application/json' \
  --data-binary @docs/examples/run_py3.json | jq
```

| File | Language id | Notes |
| --- | --- | --- |
| `run_c.json` | `c` | Doubles an integer from stdin; two test cases. |
| `run_cpp.json` | `cpp` | Sums two integers; passes `-std=c++17` via the build flag allow-list. |
| `run_py3.json` | `py3` | Interpreted; no `build` block. |
| `run_java.json` | `java` | Requires `source_filename` / `artifact_filename` to match the public class. |
| `run_js.json` | `js` | Reads all of stdin before printing. |
