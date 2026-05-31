"use strict";

// Demo programs for the playground. This mirrors the structure of
// tests/lib/sources.ts: each program has an id, a human-readable label, a list
// of {stdin, expected_stdout} cases, and a per-language source map (`by`).
//
// The page script consumes EXAMPLES, keyed by language id, so at the bottom we
// pivot PROGRAMS into that shape — a language's picker lists every program that
// has a source for it.

const PROGRAMS = [
  // 1. Hello world
  {
    id: "hello",
    label: "Hello world",
    cases: [{ stdin: "", expected_stdout: "hi" }],
    by: {
      py3: "import sys\nsys.stdout.write('hi')",
      bash: "printf 'hi'",
      cpp: '#include <iostream>\n\nint main() {\n\tstd::cout << "hi";\n\treturn 0;\n}',
      c: '#include <stdio.h>\n\nint main() {\n\tprintf("hi");\n\treturn 0;\n}',
      java: 'public class Solution {\n\tpublic static void main(String[] a) {\n\t\tSystem.out.print("hi");\n\t}\n}',
      js: "process.stdout.write('hi')",
      go: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Print("hi")\n}',
      rust: 'fn main() {\n\tprint!("hi");\n}',
    },
  },
  // 2. Echo stdin uppercased
  {
    id: "echo-upper",
    label: "Uppercase stdin",
    cases: [
      { stdin: "hello\n", expected_stdout: "HELLO\n" },
      { stdin: "abc xyz", expected_stdout: "ABC XYZ" },
    ],
    by: {
      py3: "import sys\nsys.stdout.write(sys.stdin.read().upper())",
      bash: "tr '[:lower:]' '[:upper:]'",
      cpp: '#include <iostream>\n#include <cctype>\n\nint main() {\n\tint c;\n\twhile ((c = std::cin.get()) != EOF)\n\t\tstd::cout << (char)std::toupper(c);\n\treturn 0;\n}',
      c: '#include <stdio.h>\n#include <ctype.h>\n\nint main() {\n\tint c;\n\twhile ((c = getchar()) != EOF)\n\t\tputchar(toupper(c));\n\treturn 0;\n}',
      java: 'import java.io.*;\n\npublic class Solution {\n\tpublic static void main(String[] a) throws Exception {\n\t\tBufferedReader r = new BufferedReader(new InputStreamReader(System.in));\n\t\tStringBuilder s = new StringBuilder();\n\t\tint c;\n\t\twhile ((c = r.read()) != -1)\n\t\t\ts.append((char) c);\n\t\tSystem.out.print(s.toString().toUpperCase());\n\t}\n}',
      js: "let d = '';\nprocess.stdin.on('data', c => d += c);\nprocess.stdin.on('end', () => process.stdout.write(d.toUpperCase()));",
      go: 'package main\n\nimport (\n\t"io"\n\t"os"\n\t"strings"\n)\n\nfunc main() {\n\tb, _ := io.ReadAll(os.Stdin)\n\tos.Stdout.WriteString(strings.ToUpper(string(b)))\n}',
      rust: 'use std::io::Read;\n\nfn main() {\n\tlet mut s = String::new();\n\tstd::io::stdin().read_to_string(&mut s).unwrap();\n\tprint!("{}", s.to_uppercase());\n}',
    },
  },
  // 3. Sum of two ints from stdin
  {
    id: "sum-two",
    label: "Sum of two ints",
    cases: [
      { stdin: "3 5\n", expected_stdout: "8" },
      { stdin: "10 -4", expected_stdout: "6" },
    ],
    by: {
      py3: "a, b = map(int, input().split())\nprint(a + b, end='')",
      bash: "read a b\nprintf '%d' \"$((a + b))\"",
      cpp: '#include <iostream>\n\nint main() {\n\tlong a, b;\n\tstd::cin >> a >> b;\n\tstd::cout << a + b;\n\treturn 0;\n}',
      c: '#include <stdio.h>\n\nint main() {\n\tlong a, b;\n\tscanf("%ld %ld", &a, &b);\n\tprintf("%ld", a + b);\n\treturn 0;\n}',
      java: 'import java.util.*;\n\npublic class Solution {\n\tpublic static void main(String[] a) {\n\t\tScanner s = new Scanner(System.in);\n\t\tlong x = s.nextLong(), y = s.nextLong();\n\t\tSystem.out.print(x + y);\n\t}\n}',
      js: "let d = '';\nprocess.stdin.on('data', c => d += c);\nprocess.stdin.on('end', () => {\n\tconst [a, b] = d.trim().split(/\\s+/).map(Number);\n\tprocess.stdout.write(String(a + b));\n});",
      go: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tvar a, b int64\n\tfmt.Scan(&a, &b)\n\tfmt.Print(a + b)\n}',
      rust: 'use std::io::Read;\n\nfn main() {\n\tlet mut s = String::new();\n\tstd::io::stdin().read_to_string(&mut s).unwrap();\n\tlet v: Vec<i64> = s.split_whitespace().map(|x| x.parse().unwrap()).collect();\n\tprint!("{}", v[0] + v[1]);\n}',
    },
  },
  // 4. Factorial of N from stdin
  {
    id: "factorial",
    label: "Factorial of N",
    cases: [
      { stdin: "5", expected_stdout: "120" },
      { stdin: "0", expected_stdout: "1" },
    ],
    by: {
      py3: "import math\nn = int(input())\nprint(math.factorial(n), end='')",
      bash: "read n\nr=1\nfor ((i = 2; i <= n; i++)); do\n\tr=$((r * i))\ndone\nprintf '%d' \"$r\"",
      cpp: '#include <iostream>\n\nint main() {\n\tlong n, r = 1;\n\tstd::cin >> n;\n\tfor (long i = 2; i <= n; i++)\n\t\tr *= i;\n\tstd::cout << r;\n\treturn 0;\n}',
      c: '#include <stdio.h>\n\nint main() {\n\tlong n, r = 1;\n\tscanf("%ld", &n);\n\tfor (long i = 2; i <= n; i++)\n\t\tr *= i;\n\tprintf("%ld", r);\n\treturn 0;\n}',
      java: 'import java.util.*;\n\npublic class Solution {\n\tpublic static void main(String[] a) {\n\t\tScanner s = new Scanner(System.in);\n\t\tlong n = s.nextLong(), r = 1;\n\t\tfor (long i = 2; i <= n; i++)\n\t\t\tr *= i;\n\t\tSystem.out.print(r);\n\t}\n}',
      js: "let d = '';\nprocess.stdin.on('data', c => d += c);\nprocess.stdin.on('end', () => {\n\tlet n = parseInt(d), r = 1n;\n\tfor (let i = 2n; i <= BigInt(n); i++)\n\t\tr *= i;\n\tprocess.stdout.write(r.toString());\n});",
      go: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tvar n int64\n\tfmt.Scan(&n)\n\tr := int64(1)\n\tfor i := int64(2); i <= n; i++ {\n\t\tr *= i\n\t}\n\tfmt.Print(r)\n}',
      rust: 'use std::io::Read;\n\nfn main() {\n\tlet mut s = String::new();\n\tstd::io::stdin().read_to_string(&mut s).unwrap();\n\tlet n: u64 = s.trim().parse().unwrap();\n\tlet mut r: u64 = 1;\n\tfor i in 2..=n {\n\t\tr *= i;\n\t}\n\tprint!("{}", r);\n}',
    },
  },
  // 5. Reverse a string
  {
    id: "reverse",
    label: "Reverse a string",
    cases: [{ stdin: "hello", expected_stdout: "olleh" }],
    by: {
      py3: "import sys\nsys.stdout.write(sys.stdin.read()[::-1])",
      bash: 's=$(cat)\nout=""\nfor ((i = ${#s} - 1; i >= 0; i--)); do\n\tout+="${s:i:1}"\ndone\nprintf "%s" "$out"',
      cpp: '#include <iostream>\n#include <string>\n#include <algorithm>\n\nint main() {\n\tstd::string s, line;\n\twhile (std::getline(std::cin, line))\n\t\ts += line;\n\tstd::reverse(s.begin(), s.end());\n\tstd::cout << s;\n\treturn 0;\n}',
      c: '#include <stdio.h>\n#include <string.h>\n\nint main() {\n\tchar b[4096];\n\tint n = fread(b, 1, sizeof(b), stdin);\n\tfor (int i = n - 1; i >= 0; i--)\n\t\tputchar(b[i]);\n\treturn 0;\n}',
      java: 'import java.io.*;\n\npublic class Solution {\n\tpublic static void main(String[] a) throws Exception {\n\t\tBufferedReader r = new BufferedReader(new InputStreamReader(System.in));\n\t\tStringBuilder s = new StringBuilder();\n\t\tint c;\n\t\twhile ((c = r.read()) != -1)\n\t\t\ts.append((char) c);\n\t\tSystem.out.print(s.reverse().toString());\n\t}\n}',
      js: "let d = '';\nprocess.stdin.on('data', c => d += c);\nprocess.stdin.on('end', () => process.stdout.write(d.split('').reverse().join('')));",
      go: 'package main\n\nimport (\n\t"io"\n\t"os"\n)\n\nfunc main() {\n\tb, _ := io.ReadAll(os.Stdin)\n\tfor i := len(b) - 1; i >= 0; i-- {\n\t\tos.Stdout.Write(b[i : i+1])\n\t}\n}',
      rust: 'use std::io::Read;\n\nfn main() {\n\tlet mut s = String::new();\n\tstd::io::stdin().read_to_string(&mut s).unwrap();\n\tlet r: String = s.chars().rev().collect();\n\tprint!("{}", r);\n}',
    },
  },
  // 6. Count vowels (aeiou, ascii lowercase)
  {
    id: "count-vowels",
    label: "Count vowels",
    cases: [
      { stdin: "hello world", expected_stdout: "3" },
      { stdin: "xyz", expected_stdout: "0" },
    ],
    by: {
      py3: "import sys\ns = sys.stdin.read()\nprint(sum(c in 'aeiou' for c in s), end='')",
      bash: 's=$(cat)\nn=0\nfor ((i = 0; i < ${#s}; i++)); do\n\tcase "${s:i:1}" in\n\t\t[aeiou]) n=$((n + 1)) ;;\n\tesac\ndone\nprintf "%d" "$n"',
      cpp: "#include <iostream>\n\nint main() {\n\tint c, n = 0;\n\twhile ((c = std::cin.get()) != EOF)\n\t\tif (c == 'a' || c == 'e' || c == 'i' || c == 'o' || c == 'u')\n\t\t\tn++;\n\tstd::cout << n;\n\treturn 0;\n}",
      c: "#include <stdio.h>\n\nint main() {\n\tint c, n = 0;\n\twhile ((c = getchar()) != EOF)\n\t\tif (c == 'a' || c == 'e' || c == 'i' || c == 'o' || c == 'u')\n\t\t\tn++;\n\tprintf(\"%d\", n);\n\treturn 0;\n}",
      java: 'import java.io.*;\n\npublic class Solution {\n\tpublic static void main(String[] a) throws Exception {\n\t\tint c, n = 0;\n\t\twhile ((c = System.in.read()) != -1)\n\t\t\tif ("aeiou".indexOf(c) >= 0)\n\t\t\t\tn++;\n\t\tSystem.out.print(n);\n\t}\n}',
      js: "let d = '';\nprocess.stdin.on('data', c => d += c);\nprocess.stdin.on('end', () => {\n\tlet n = 0;\n\tfor (const c of d)\n\t\tif ('aeiou'.includes(c))\n\t\t\tn++;\n\tprocess.stdout.write(String(n));\n});",
      go: 'package main\n\nimport (\n\t"fmt"\n\t"io"\n\t"os"\n)\n\nfunc main() {\n\tb, _ := io.ReadAll(os.Stdin)\n\tn := 0\n\tfor _, c := range b {\n\t\tswitch c {\n\t\tcase \'a\', \'e\', \'i\', \'o\', \'u\':\n\t\t\tn++\n\t\t}\n\t}\n\tfmt.Print(n)\n}',
      rust: 'use std::io::Read;\n\nfn main() {\n\tlet mut s = String::new();\n\tstd::io::stdin().read_to_string(&mut s).unwrap();\n\tlet n = s.chars().filter(|c| "aeiou".contains(*c)).count();\n\tprint!("{}", n);\n}',
    },
  },
  // 7. Is palindrome — print "yes" or "no"
  {
    id: "palindrome",
    label: "Palindrome check",
    cases: [
      { stdin: "abcba", expected_stdout: "yes" },
      { stdin: "abc", expected_stdout: "no" },
    ],
    by: {
      py3: "import sys\ns = sys.stdin.read()\nprint('yes' if s == s[::-1] else 'no', end='')",
      bash: 's=$(cat)\nr=""\nfor ((i = ${#s} - 1; i >= 0; i--)); do\n\tr+="${s:i:1}"\ndone\nif [ "$s" = "$r" ]; then\n\tprintf "yes"\nelse\n\tprintf "no"\nfi',
      cpp: '#include <iostream>\n#include <string>\n#include <algorithm>\n\nint main() {\n\tstd::string s, t;\n\twhile (std::getline(std::cin, t))\n\t\ts += t;\n\tstd::string r = s;\n\tstd::reverse(r.begin(), r.end());\n\tstd::cout << (s == r ? "yes" : "no");\n\treturn 0;\n}',
      c: '#include <stdio.h>\n#include <string.h>\n\nint main() {\n\tchar b[4096];\n\tint n = fread(b, 1, sizeof(b), stdin);\n\tint ok = 1;\n\tfor (int i = 0; i < n / 2; i++)\n\t\tif (b[i] != b[n - 1 - i]) {\n\t\t\tok = 0;\n\t\t\tbreak;\n\t\t}\n\tprintf("%s", ok ? "yes" : "no");\n\treturn 0;\n}',
      java: 'import java.io.*;\n\npublic class Solution {\n\tpublic static void main(String[] a) throws Exception {\n\t\tBufferedReader r = new BufferedReader(new InputStreamReader(System.in));\n\t\tStringBuilder s = new StringBuilder();\n\t\tint c;\n\t\twhile ((c = r.read()) != -1)\n\t\t\ts.append((char) c);\n\t\tString x = s.toString();\n\t\tSystem.out.print(x.equals(s.reverse().toString()) ? "yes" : "no");\n\t}\n}',
      js: "let d = '';\nprocess.stdin.on('data', c => d += c);\nprocess.stdin.on('end', () => {\n\tconst r = d.split('').reverse().join('');\n\tprocess.stdout.write(d === r ? 'yes' : 'no');\n});",
      go: 'package main\n\nimport (\n\t"fmt"\n\t"io"\n\t"os"\n)\n\nfunc main() {\n\tb, _ := io.ReadAll(os.Stdin)\n\tok := true\n\tfor i, j := 0, len(b)-1; i < j; i, j = i+1, j-1 {\n\t\tif b[i] != b[j] {\n\t\t\tok = false\n\t\t\tbreak\n\t\t}\n\t}\n\tif ok {\n\t\tfmt.Print("yes")\n\t} else {\n\t\tfmt.Print("no")\n\t}\n}',
      rust: 'use std::io::Read;\n\nfn main() {\n\tlet mut s = String::new();\n\tstd::io::stdin().read_to_string(&mut s).unwrap();\n\tlet r: String = s.chars().rev().collect();\n\tprint!("{}", if s == r { "yes" } else { "no" });\n}',
    },
  },
  // 8. FizzBuzz 1..N
  {
    id: "fizzbuzz",
    label: "FizzBuzz to N",
    cases: [{ stdin: "5", expected_stdout: "1\n2\nFizz\n4\nBuzz\n" }],
    by: {
      py3: "n = int(input())\nfor i in range(1, n + 1):\n\tif i % 15 == 0:\n\t\tprint('FizzBuzz')\n\telif i % 3 == 0:\n\t\tprint('Fizz')\n\telif i % 5 == 0:\n\t\tprint('Buzz')\n\telse:\n\t\tprint(i)",
      bash: 'read n\nfor ((i = 1; i <= n; i++)); do\n\tif ((i % 15 == 0)); then\n\t\techo FizzBuzz\n\telif ((i % 3 == 0)); then\n\t\techo Fizz\n\telif ((i % 5 == 0)); then\n\t\techo Buzz\n\telse\n\t\techo "$i"\n\tfi\ndone',
      cpp: '#include <iostream>\n\nint main() {\n\tint n;\n\tstd::cin >> n;\n\tfor (int i = 1; i <= n; i++) {\n\t\tif (i % 15 == 0)\n\t\t\tstd::cout << "FizzBuzz";\n\t\telse if (i % 3 == 0)\n\t\t\tstd::cout << "Fizz";\n\t\telse if (i % 5 == 0)\n\t\t\tstd::cout << "Buzz";\n\t\telse\n\t\t\tstd::cout << i;\n\t\tstd::cout << "\\n";\n\t}\n\treturn 0;\n}',
      c: '#include <stdio.h>\n\nint main() {\n\tint n;\n\tscanf("%d", &n);\n\tfor (int i = 1; i <= n; i++) {\n\t\tif (i % 15 == 0)\n\t\t\tprintf("FizzBuzz\\n");\n\t\telse if (i % 3 == 0)\n\t\t\tprintf("Fizz\\n");\n\t\telse if (i % 5 == 0)\n\t\t\tprintf("Buzz\\n");\n\t\telse\n\t\t\tprintf("%d\\n", i);\n\t}\n\treturn 0;\n}',
      java: 'import java.util.*;\n\npublic class Solution {\n\tpublic static void main(String[] a) {\n\t\tScanner s = new Scanner(System.in);\n\t\tint n = s.nextInt();\n\t\tStringBuilder b = new StringBuilder();\n\t\tfor (int i = 1; i <= n; i++) {\n\t\t\tif (i % 15 == 0)\n\t\t\t\tb.append("FizzBuzz");\n\t\t\telse if (i % 3 == 0)\n\t\t\t\tb.append("Fizz");\n\t\t\telse if (i % 5 == 0)\n\t\t\t\tb.append("Buzz");\n\t\t\telse\n\t\t\t\tb.append(i);\n\t\t\tb.append("\\n");\n\t\t}\n\t\tSystem.out.print(b);\n\t}\n}',
      js: "let d = '';\nprocess.stdin.on('data', c => d += c);\nprocess.stdin.on('end', () => {\n\tconst n = parseInt(d);\n\tlet o = '';\n\tfor (let i = 1; i <= n; i++) {\n\t\tif (i % 15 === 0) o += 'FizzBuzz';\n\t\telse if (i % 3 === 0) o += 'Fizz';\n\t\telse if (i % 5 === 0) o += 'Buzz';\n\t\telse o += i;\n\t\to += '\\n';\n\t}\n\tprocess.stdout.write(o);\n});",
      go: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tvar n int\n\tfmt.Scan(&n)\n\tfor i := 1; i <= n; i++ {\n\t\tif i%15 == 0 {\n\t\t\tfmt.Println("FizzBuzz")\n\t\t} else if i%3 == 0 {\n\t\t\tfmt.Println("Fizz")\n\t\t} else if i%5 == 0 {\n\t\t\tfmt.Println("Buzz")\n\t\t} else {\n\t\t\tfmt.Println(i)\n\t\t}\n\t}\n}',
      rust: 'use std::io::Read;\n\nfn main() {\n\tlet mut s = String::new();\n\tstd::io::stdin().read_to_string(&mut s).unwrap();\n\tlet n: i64 = s.trim().parse().unwrap();\n\tlet mut o = String::new();\n\tfor i in 1..=n {\n\t\tif i % 15 == 0 {\n\t\t\to.push_str("FizzBuzz")\n\t\t} else if i % 3 == 0 {\n\t\t\to.push_str("Fizz")\n\t\t} else if i % 5 == 0 {\n\t\t\to.push_str("Buzz")\n\t\t} else {\n\t\t\to.push_str(&i.to_string())\n\t\t};\n\t\to.push(\'\\n\');\n\t}\n\tprint!("{}", o);\n}',
    },
  },
  // Verilog has no entry in sources.ts; keep a couple of native demos so the
  // language still has examples in the picker.
  {
    id: "verilog-hello",
    label: "Hello (display)",
    cases: [{ stdin: "", expected_stdout: "hello from verilog\n" }],
    by: {
      verilog: `module main;
  initial begin
    $display("hello from verilog");
    $finish;
  end
endmodule
`,
    },
  },
  {
    id: "verilog-count",
    label: "Count 0..4",
    cases: [{ stdin: "", expected_stdout: "0\n1\n2\n3\n4\n" }],
    by: {
      verilog: `module main;
  integer i;
  initial begin
    for (i = 0; i < 5; i = i + 1)
      $display("%0d", i);
    $finish;
  end
endmodule
`,
    },
  },
];

// Pivot PROGRAMS into the language-keyed shape the page expects:
//   EXAMPLES[lang] = [{ label, source, tests: [{stdin, expected_stdout}] }]
const EXAMPLES = {};
for (const p of PROGRAMS) {
  for (const lang of Object.keys(p.by)) {
    if (!EXAMPLES[lang]) EXAMPLES[lang] = [];
    EXAMPLES[lang].push({ id: p.id, label: p.label, source: p.by[lang], tests: p.cases });
  }
}
