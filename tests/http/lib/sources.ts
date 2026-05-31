// @ts-nocheck
// Per-language source snippets shared by integration and corpus suites.
// Each program has a deterministic spec: given stdin, produce expected_stdout.

export type Lang = "py3" | "cpp" | "c" | "java" | "js" | "go" | "rust";

export type LangSource = {
  language: Lang;
  source: string;
  source_filename?: string;
  artifact_filename?: string;
};

export type Program = {
  id: string;
  description: string;
  cases: { stdin: string; expected_stdout: string }[];
  by: Record<Lang, LangSource>;
};

// 1. Hello world
const hello: Program = {
  id: "hello",
  description: "print 'hi'",
  cases: [{ stdin: "", expected_stdout: "hi" }],
  by: {
    py3: { language: "py3", source: "import sys; sys.stdout.write('hi')" },
    cpp: {
      language: "cpp",
      source: '#include <iostream>\nint main(){std::cout<<"hi";return 0;}',
    },
    c: {
      language: "c",
      source: '#include <stdio.h>\nint main(){printf("hi");return 0;}',
    },
    java: {
      language: "java",
      source:
        'public class Solution{public static void main(String[]a){System.out.print("hi");}}',
      source_filename: "Solution.java",
      artifact_filename: "Solution",
    },
    js: { language: "js", source: "process.stdout.write('hi')" },
    go: {
      language: "go",
      source: 'package main\nimport "fmt"\nfunc main(){fmt.Print("hi")}',
      source_filename: "solution.go",
      artifact_filename: "solution",
    },
    rust: {
      language: "rust",
      source: 'fn main(){print!("hi");}',
      source_filename: "solution.rs",
      artifact_filename: "solution",
    },
  },
};

// 2. Echo stdin uppercased
const echoUpper: Program = {
  id: "echo-upper",
  description: "uppercase stdin",
  cases: [
    { stdin: "hello\n", expected_stdout: "HELLO\n" },
    { stdin: "abc xyz", expected_stdout: "ABC XYZ" },
  ],
  by: {
    py3: {
      language: "py3",
      source: "import sys\nsys.stdout.write(sys.stdin.read().upper())",
    },
    cpp: {
      language: "cpp",
      source:
        '#include <iostream>\n#include <cctype>\nint main(){int c;while((c=std::cin.get())!=EOF)std::cout<<(char)std::toupper(c);return 0;}',
    },
    c: {
      language: "c",
      source:
        '#include <stdio.h>\n#include <ctype.h>\nint main(){int c;while((c=getchar())!=EOF)putchar(toupper(c));return 0;}',
    },
    java: {
      language: "java",
      source:
        'import java.io.*;public class Solution{public static void main(String[]a)throws Exception{BufferedReader r=new BufferedReader(new InputStreamReader(System.in));StringBuilder s=new StringBuilder();int c;while((c=r.read())!=-1)s.append((char)c);System.out.print(s.toString().toUpperCase());}}',
      source_filename: "Solution.java",
      artifact_filename: "Solution",
    },
    js: {
      language: "js",
      source:
        "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(d.toUpperCase()))",
    },
    go: {
      language: "go",
      source:
        'package main\nimport("io";"os";"strings")\nfunc main(){b,_:=io.ReadAll(os.Stdin);os.Stdout.WriteString(strings.ToUpper(string(b)))}',
      source_filename: "solution.go",
      artifact_filename: "solution",
    },
    rust: {
      language: "rust",
      source:
        'use std::io::Read;fn main(){let mut s=String::new();std::io::stdin().read_to_string(&mut s).unwrap();print!("{}",s.to_uppercase());}',
      source_filename: "solution.rs",
      artifact_filename: "solution",
    },
  },
};

// 3. Sum of two ints from stdin
const sumTwo: Program = {
  id: "sum-two",
  description: "sum two integers from one line",
  cases: [
    { stdin: "3 5\n", expected_stdout: "8" },
    { stdin: "10 -4", expected_stdout: "6" },
  ],
  by: {
    py3: { language: "py3", source: "a,b=map(int,input().split());print(a+b,end='')" },
    cpp: {
      language: "cpp",
      source:
        "#include <iostream>\nint main(){long a,b;std::cin>>a>>b;std::cout<<a+b;return 0;}",
    },
    c: {
      language: "c",
      source: '#include <stdio.h>\nint main(){long a,b;scanf("%ld %ld",&a,&b);printf("%ld",a+b);return 0;}',
    },
    java: {
      language: "java",
      source:
        'import java.util.*;public class Solution{public static void main(String[]a){Scanner s=new Scanner(System.in);long x=s.nextLong(),y=s.nextLong();System.out.print(x+y);}}',
      source_filename: "Solution.java",
      artifact_filename: "Solution",
    },
    js: {
      language: "js",
      source:
        "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const[a,b]=d.trim().split(/\\s+/).map(Number);process.stdout.write(String(a+b))})",
    },
    go: {
      language: "go",
      source:
        'package main\nimport "fmt"\nfunc main(){var a,b int64;fmt.Scan(&a,&b);fmt.Print(a+b)}',
      source_filename: "solution.go",
      artifact_filename: "solution",
    },
    rust: {
      language: "rust",
      source:
        'use std::io::Read;fn main(){let mut s=String::new();std::io::stdin().read_to_string(&mut s).unwrap();let v:Vec<i64>=s.split_whitespace().map(|x|x.parse().unwrap()).collect();print!("{}",v[0]+v[1]);}',
      source_filename: "solution.rs",
      artifact_filename: "solution",
    },
  },
};

// 4. Factorial of N from stdin
const factorial: Program = {
  id: "factorial",
  description: "factorial of N",
  cases: [
    { stdin: "5", expected_stdout: "120" },
    { stdin: "0", expected_stdout: "1" },
  ],
  by: {
    py3: {
      language: "py3",
      source: "n=int(input());import math;print(math.factorial(n),end='')",
    },
    cpp: {
      language: "cpp",
      source:
        "#include <iostream>\nint main(){long n,r=1;std::cin>>n;for(long i=2;i<=n;i++)r*=i;std::cout<<r;return 0;}",
    },
    c: {
      language: "c",
      source:
        '#include <stdio.h>\nint main(){long n,r=1;scanf("%ld",&n);for(long i=2;i<=n;i++)r*=i;printf("%ld",r);return 0;}',
    },
    java: {
      language: "java",
      source:
        'import java.util.*;public class Solution{public static void main(String[]a){Scanner s=new Scanner(System.in);long n=s.nextLong(),r=1;for(long i=2;i<=n;i++)r*=i;System.out.print(r);}}',
      source_filename: "Solution.java",
      artifact_filename: "Solution",
    },
    js: {
      language: "js",
      source:
        "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{let n=parseInt(d),r=1n;for(let i=2n;i<=BigInt(n);i++)r*=i;process.stdout.write(r.toString())})",
    },
    go: {
      language: "go",
      source:
        'package main\nimport "fmt"\nfunc main(){var n int64;fmt.Scan(&n);r:=int64(1);for i:=int64(2);i<=n;i++{r*=i};fmt.Print(r)}',
      source_filename: "solution.go",
      artifact_filename: "solution",
    },
    rust: {
      language: "rust",
      source:
        'use std::io::Read;fn main(){let mut s=String::new();std::io::stdin().read_to_string(&mut s).unwrap();let n:u64=s.trim().parse().unwrap();let mut r:u64=1;for i in 2..=n{r*=i;}print!("{}",r);}',
      source_filename: "solution.rs",
      artifact_filename: "solution",
    },
  },
};

// 5. Reverse a string
const reverse: Program = {
  id: "reverse",
  description: "reverse stdin (single line, no trailing newline in output)",
  cases: [{ stdin: "hello", expected_stdout: "olleh" }],
  by: {
    py3: { language: "py3", source: "import sys;sys.stdout.write(sys.stdin.read()[::-1])" },
    cpp: {
      language: "cpp",
      source:
        "#include <iostream>\n#include <string>\n#include <algorithm>\nint main(){std::string s,line;while(std::getline(std::cin,line))s+=line;std::reverse(s.begin(),s.end());std::cout<<s;return 0;}",
    },
    c: {
      language: "c",
      source:
        '#include <stdio.h>\n#include <string.h>\nint main(){char b[4096];int n=fread(b,1,sizeof(b),stdin);for(int i=n-1;i>=0;i--)putchar(b[i]);return 0;}',
    },
    java: {
      language: "java",
      source:
        'import java.io.*;public class Solution{public static void main(String[]a)throws Exception{BufferedReader r=new BufferedReader(new InputStreamReader(System.in));StringBuilder s=new StringBuilder();int c;while((c=r.read())!=-1)s.append((char)c);System.out.print(s.reverse().toString());}}',
      source_filename: "Solution.java",
      artifact_filename: "Solution",
    },
    js: {
      language: "js",
      source:
        "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(d.split('').reverse().join('')))",
    },
    go: {
      language: "go",
      source:
        'package main\nimport("io";"os")\nfunc main(){b,_:=io.ReadAll(os.Stdin);for i:=len(b)-1;i>=0;i--{os.Stdout.Write(b[i:i+1])}}',
      source_filename: "solution.go",
      artifact_filename: "solution",
    },
    rust: {
      language: "rust",
      source:
        'use std::io::Read;fn main(){let mut s=String::new();std::io::stdin().read_to_string(&mut s).unwrap();let r:String=s.chars().rev().collect();print!("{}",r);}',
      source_filename: "solution.rs",
      artifact_filename: "solution",
    },
  },
};

// 6. Count vowels (aeiou, ascii lowercase)
const vowels: Program = {
  id: "count-vowels",
  description: "count lowercase vowels",
  cases: [
    { stdin: "hello world", expected_stdout: "3" },
    { stdin: "xyz", expected_stdout: "0" },
  ],
  by: {
    py3: {
      language: "py3",
      source: "import sys;s=sys.stdin.read();print(sum(c in 'aeiou' for c in s),end='')",
    },
    cpp: {
      language: "cpp",
      source:
        '#include <iostream>\nint main(){int c,n=0;while((c=std::cin.get())!=EOF)if(c==\'a\'||c==\'e\'||c==\'i\'||c==\'o\'||c==\'u\')n++;std::cout<<n;return 0;}',
    },
    c: {
      language: "c",
      source:
        '#include <stdio.h>\nint main(){int c,n=0;while((c=getchar())!=EOF)if(c==\'a\'||c==\'e\'||c==\'i\'||c==\'o\'||c==\'u\')n++;printf("%d",n);return 0;}',
    },
    java: {
      language: "java",
      source:
        'import java.io.*;public class Solution{public static void main(String[]a)throws Exception{int c,n=0;while((c=System.in.read())!=-1)if("aeiou".indexOf(c)>=0)n++;System.out.print(n);}}',
      source_filename: "Solution.java",
      artifact_filename: "Solution",
    },
    js: {
      language: "js",
      source:
        "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{let n=0;for(const c of d)if('aeiou'.includes(c))n++;process.stdout.write(String(n))})",
    },
    go: {
      language: "go",
      source:
        "package main\nimport(\"fmt\";\"io\";\"os\")\nfunc main(){b,_:=io.ReadAll(os.Stdin);n:=0;for _,c:=range b{switch c{case 'a','e','i','o','u':n++}};fmt.Print(n)}",
      source_filename: "solution.go",
      artifact_filename: "solution",
    },
    rust: {
      language: "rust",
      source:
        'use std::io::Read;fn main(){let mut s=String::new();std::io::stdin().read_to_string(&mut s).unwrap();let n=s.chars().filter(|c|"aeiou".contains(*c)).count();print!("{}",n);}',
      source_filename: "solution.rs",
      artifact_filename: "solution",
    },
  },
};

// 7. Is palindrome — print "yes" or "no"
const palindrome: Program = {
  id: "palindrome",
  description: "is stdin a palindrome",
  cases: [
    { stdin: "abcba", expected_stdout: "yes" },
    { stdin: "abc", expected_stdout: "no" },
  ],
  by: {
    py3: {
      language: "py3",
      source: "import sys;s=sys.stdin.read();print('yes' if s==s[::-1] else 'no',end='')",
    },
    cpp: {
      language: "cpp",
      source:
        '#include <iostream>\n#include <string>\n#include <algorithm>\nint main(){std::string s,t;while(std::getline(std::cin,t))s+=t;std::string r=s;std::reverse(r.begin(),r.end());std::cout<<(s==r?"yes":"no");return 0;}',
    },
    c: {
      language: "c",
      source:
        '#include <stdio.h>\n#include <string.h>\nint main(){char b[4096];int n=fread(b,1,sizeof(b),stdin);int ok=1;for(int i=0;i<n/2;i++)if(b[i]!=b[n-1-i]){ok=0;break;}printf("%s",ok?"yes":"no");return 0;}',
    },
    java: {
      language: "java",
      source:
        'import java.io.*;public class Solution{public static void main(String[]a)throws Exception{BufferedReader r=new BufferedReader(new InputStreamReader(System.in));StringBuilder s=new StringBuilder();int c;while((c=r.read())!=-1)s.append((char)c);String x=s.toString();System.out.print(x.equals(s.reverse().toString())?"yes":"no");}}',
      source_filename: "Solution.java",
      artifact_filename: "Solution",
    },
    js: {
      language: "js",
      source:
        "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=d.split('').reverse().join('');process.stdout.write(d===r?'yes':'no')})",
    },
    go: {
      language: "go",
      source:
        'package main\nimport("fmt";"io";"os")\nfunc main(){b,_:=io.ReadAll(os.Stdin);ok:=true;for i,j:=0,len(b)-1;i<j;i,j=i+1,j-1{if b[i]!=b[j]{ok=false;break}};if ok{fmt.Print("yes")}else{fmt.Print("no")}}',
      source_filename: "solution.go",
      artifact_filename: "solution",
    },
    rust: {
      language: "rust",
      source:
        'use std::io::Read;fn main(){let mut s=String::new();std::io::stdin().read_to_string(&mut s).unwrap();let r:String=s.chars().rev().collect();print!("{}",if s==r{"yes"}else{"no"});}',
      source_filename: "solution.rs",
      artifact_filename: "solution",
    },
  },
};

// 8. FizzBuzz 1..N
const fizzbuzz: Program = {
  id: "fizzbuzz",
  description: "fizzbuzz 1..N, newline separated",
  cases: [
    {
      stdin: "5",
      expected_stdout: "1\n2\nFizz\n4\nBuzz\n",
    },
  ],
  by: {
    py3: {
      language: "py3",
      source:
        "n=int(input())\nfor i in range(1,n+1):\n  if i%15==0:print('FizzBuzz')\n  elif i%3==0:print('Fizz')\n  elif i%5==0:print('Buzz')\n  else:print(i)\n",
    },
    cpp: {
      language: "cpp",
      source:
        '#include <iostream>\nint main(){int n;std::cin>>n;for(int i=1;i<=n;i++){if(i%15==0)std::cout<<"FizzBuzz";else if(i%3==0)std::cout<<"Fizz";else if(i%5==0)std::cout<<"Buzz";else std::cout<<i;std::cout<<"\\n";}return 0;}',
    },
    c: {
      language: "c",
      source:
        '#include <stdio.h>\nint main(){int n;scanf("%d",&n);for(int i=1;i<=n;i++){if(i%15==0)printf("FizzBuzz\\n");else if(i%3==0)printf("Fizz\\n");else if(i%5==0)printf("Buzz\\n");else printf("%d\\n",i);}return 0;}',
    },
    java: {
      language: "java",
      source:
        'import java.util.*;public class Solution{public static void main(String[]a){Scanner s=new Scanner(System.in);int n=s.nextInt();StringBuilder b=new StringBuilder();for(int i=1;i<=n;i++){if(i%15==0)b.append("FizzBuzz");else if(i%3==0)b.append("Fizz");else if(i%5==0)b.append("Buzz");else b.append(i);b.append("\\n");}System.out.print(b);}}',
      source_filename: "Solution.java",
      artifact_filename: "Solution",
    },
    js: {
      language: "js",
      source:
        "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const n=parseInt(d);let o='';for(let i=1;i<=n;i++){if(i%15===0)o+='FizzBuzz';else if(i%3===0)o+='Fizz';else if(i%5===0)o+='Buzz';else o+=i;o+='\\n'}process.stdout.write(o)})",
    },
    go: {
      language: "go",
      source:
        'package main\nimport "fmt"\nfunc main(){var n int;fmt.Scan(&n);for i:=1;i<=n;i++{if i%15==0{fmt.Println("FizzBuzz")}else if i%3==0{fmt.Println("Fizz")}else if i%5==0{fmt.Println("Buzz")}else{fmt.Println(i)}}}',
      source_filename: "solution.go",
      artifact_filename: "solution",
    },
    rust: {
      language: "rust",
      source:
        'use std::io::Read;fn main(){let mut s=String::new();std::io::stdin().read_to_string(&mut s).unwrap();let n:i64=s.trim().parse().unwrap();let mut o=String::new();for i in 1..=n{if i%15==0{o.push_str("FizzBuzz")}else if i%3==0{o.push_str("Fizz")}else if i%5==0{o.push_str("Buzz")}else{o.push_str(&i.to_string())};o.push(\'\\n\');}print!("{}",o);}',
      source_filename: "solution.rs",
      artifact_filename: "solution",
    },
  },
};

export const PROGRAMS: Program[] = [
  hello,
  echoUpper,
  sumTwo,
  factorial,
  reverse,
  vowels,
  palindrome,
  fizzbuzz,
];

export const LANGS: Lang[] = ["py3", "cpp", "c", "java", "js", "go", "rust"];
