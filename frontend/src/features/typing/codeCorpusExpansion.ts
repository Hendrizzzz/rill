import type { CodeLanguage } from "./types";
import type { CodeTemplate } from "./codeCorpusModel";

const CPP: readonly CodeTemplate[] = [
  {
    slug: "linear-search",
    title: "Find a value by scanning",
    topic: "linear search",
    functionName: "linearSearch",
    code: `int __FN__(const vector<int>& values, int target) {
  for (size_t index = 0; index < values.size(); index++) {
    if (values[index] == target) return static_cast<int>(index);
  }
  return -1;
}`,
  },
  {
    slug: "minimum",
    title: "Find the minimum",
    topic: "array scan",
    functionName: "findMinimum",
    code: `int __FN__(const vector<int>& values) {
  int best = values.front();
  for (int value : values) {
    best = min(best, value);
  }
  return best;
}`,
  },
  {
    slug: "count-occurrences",
    title: "Count matching values",
    topic: "frequency scan",
    functionName: "countOccurrences",
    code: `int __FN__(const vector<int>& values, int target) {
  int count = 0;
  for (int value : values) {
    if (value == target) count++;
  }
  return count;
}`,
  },
  {
    slug: "sorted-check",
    title: "Check sorted order",
    topic: "adjacent comparison",
    functionName: "isSorted",
    code: `bool __FN__(const vector<int>& values) {
  for (size_t index = 1; index < values.size(); index++) {
    if (values[index] < values[index - 1]) return false;
  }
  return true;
}`,
  },
  {
    slug: "factorial",
    title: "Calculate a factorial",
    topic: "iterative product",
    functionName: "factorial",
    code: `long long __FN__(int number) {
  long long product = 1;
  for (int value = 2; value <= number; value++) {
    product *= value;
  }
  return product;
}`,
  },
  {
    slug: "prime-check",
    title: "Check a prime number",
    topic: "number theory",
    functionName: "isPrime",
    code: `bool __FN__(int number) {
  if (number < 2) return false;
  for (int divisor = 2; divisor <= number / divisor; divisor++) {
    if (number % divisor == 0) return false;
  }
  return true;
}`,
  },
  {
    slug: "prefix-sums",
    title: "Build prefix sums",
    topic: "prefix accumulation",
    functionName: "prefixSums",
    code: `vector<long long> __FN__(const vector<int>& values) {
  vector<long long> prefix(values.size());
  long long total = 0;
  for (size_t index = 0; index < values.size(); index++) {
    total += values[index];
    prefix[index] = total;
  }
  return prefix;
}`,
  },
  {
    slug: "maximum-subarray",
    title: "Find the best contiguous sum",
    topic: "dynamic programming",
    functionName: "maximumSubarray",
    code: `long long __FN__(const vector<int>& values) {
  long long current = values.front();
  long long best = current;
  for (size_t index = 1; index < values.size(); index++) {
    current = max<long long>(values[index], current + values[index]);
    best = max(best, current);
  }
  return best;
}`,
  },
] as const;

const JAVA: readonly CodeTemplate[] = [
  {
    slug: "linear-search",
    title: "Find a value by scanning",
    topic: "linear search",
    functionName: "linearSearch",
    code: `int __FN__(int[] values, int target) {
  for (int index = 0; index < values.length; index++) {
    if (values[index] == target) return index;
  }
  return -1;
}`,
  },
  {
    slug: "minimum",
    title: "Find the minimum",
    topic: "array scan",
    functionName: "findMinimum",
    code: `int __FN__(int[] values) {
  int best = values[0];
  for (int value : values) {
    best = Math.min(best, value);
  }
  return best;
}`,
  },
  {
    slug: "count-occurrences",
    title: "Count matching values",
    topic: "frequency scan",
    functionName: "countOccurrences",
    code: `int __FN__(int[] values, int target) {
  int count = 0;
  for (int value : values) {
    if (value == target) count++;
  }
  return count;
}`,
  },
  {
    slug: "sorted-check",
    title: "Check sorted order",
    topic: "adjacent comparison",
    functionName: "isSorted",
    code: `boolean __FN__(int[] values) {
  for (int index = 1; index < values.length; index++) {
    if (values[index] < values[index - 1]) return false;
  }
  return true;
}`,
  },
  {
    slug: "factorial",
    title: "Calculate a factorial",
    topic: "iterative product",
    functionName: "factorial",
    code: `long __FN__(int number) {
  long product = 1;
  for (int value = 2; value <= number; value++) {
    product *= value;
  }
  return product;
}`,
  },
  {
    slug: "prime-check",
    title: "Check a prime number",
    topic: "number theory",
    functionName: "isPrime",
    code: `boolean __FN__(int number) {
  if (number < 2) return false;
  for (int divisor = 2; divisor <= number / divisor; divisor++) {
    if (number % divisor == 0) return false;
  }
  return true;
}`,
  },
  {
    slug: "prefix-sums",
    title: "Build prefix sums",
    topic: "prefix accumulation",
    functionName: "prefixSums",
    code: `long[] __FN__(int[] values) {
  long[] prefix = new long[values.length];
  long total = 0;
  for (int index = 0; index < values.length; index++) {
    total += values[index];
    prefix[index] = total;
  }
  return prefix;
}`,
  },
  {
    slug: "maximum-subarray",
    title: "Find the best contiguous sum",
    topic: "dynamic programming",
    functionName: "maximumSubarray",
    code: `long __FN__(int[] values) {
  long current = values[0];
  long best = current;
  for (int index = 1; index < values.length; index++) {
    current = Math.max(values[index], current + values[index]);
    best = Math.max(best, current);
  }
  return best;
}`,
  },
] as const;

const PYTHON3: readonly CodeTemplate[] = [
  {
    slug: "linear-search",
    title: "Find a value by scanning",
    topic: "linear search",
    functionName: "linear_search",
    code: `def __FN__(values: list[int], target: int) -> int:
  for index, value in enumerate(values):
    if value == target:
      return index
  return -1`,
  },
  {
    slug: "minimum",
    title: "Find the minimum",
    topic: "array scan",
    functionName: "find_minimum",
    code: `def __FN__(values: list[int]) -> int:
  best = values[0]
  for value in values:
    best = min(best, value)
  return best`,
  },
  {
    slug: "count-occurrences",
    title: "Count matching values",
    topic: "frequency scan",
    functionName: "count_occurrences",
    code: `def __FN__(values: list[int], target: int) -> int:
  count = 0
  for value in values:
    if value == target:
      count += 1
  return count`,
  },
  {
    slug: "sorted-check",
    title: "Check sorted order",
    topic: "adjacent comparison",
    functionName: "is_sorted",
    code: `def __FN__(values: list[int]) -> bool:
  for index in range(1, len(values)):
    if values[index] < values[index - 1]:
      return False
  return True`,
  },
  {
    slug: "factorial",
    title: "Calculate a factorial",
    topic: "iterative product",
    functionName: "factorial",
    code: `def __FN__(number: int) -> int:
  product = 1
  for value in range(2, number + 1):
    product *= value
  return product`,
  },
  {
    slug: "prime-check",
    title: "Check a prime number",
    topic: "number theory",
    functionName: "is_prime",
    code: `def __FN__(number: int) -> bool:
  if number < 2:
    return False
  divisor = 2
  while divisor <= number // divisor:
    if number % divisor == 0:
      return False
    divisor += 1
  return True`,
  },
  {
    slug: "prefix-sums",
    title: "Build prefix sums",
    topic: "prefix accumulation",
    functionName: "prefix_sums",
    code: `def __FN__(values: list[int]) -> list[int]:
  prefix: list[int] = []
  total = 0
  for value in values:
    total += value
    prefix.append(total)
  return prefix`,
  },
  {
    slug: "maximum-subarray",
    title: "Find the best contiguous sum",
    topic: "dynamic programming",
    functionName: "maximum_subarray",
    code: `def __FN__(values: list[int]) -> int:
  current = values[0]
  best = current
  for index in range(1, len(values)):
    value = values[index]
    current = max(value, current + value)
    best = max(best, current)
  return best`,
  },
] as const;

const C: readonly CodeTemplate[] = [
  {
    slug: "linear-search",
    title: "Find a value by scanning",
    topic: "linear search",
    functionName: "linear_search",
    code: `int __FN__(const int *values, size_t length, int target) {
  for (size_t index = 0; index < length; index++) {
    if (values[index] == target) return (int) index;
  }
  return -1;
}`,
  },
  {
    slug: "minimum",
    title: "Find the minimum",
    topic: "array scan",
    functionName: "find_minimum",
    code: `int __FN__(const int *values, size_t length) {
  int best = values[0];
  for (size_t index = 1; index < length; index++) {
    if (values[index] < best) best = values[index];
  }
  return best;
}`,
  },
  {
    slug: "count-occurrences",
    title: "Count matching values",
    topic: "frequency scan",
    functionName: "count_occurrences",
    code: `size_t __FN__(const int *values, size_t length, int target) {
  size_t count = 0;
  for (size_t index = 0; index < length; index++) {
    if (values[index] == target) count++;
  }
  return count;
}`,
  },
  {
    slug: "sorted-check",
    title: "Check sorted order",
    topic: "adjacent comparison",
    functionName: "is_sorted",
    code: `bool __FN__(const int *values, size_t length) {
  for (size_t index = 1; index < length; index++) {
    if (values[index] < values[index - 1]) return false;
  }
  return true;
}`,
  },
  {
    slug: "factorial",
    title: "Calculate a factorial",
    topic: "iterative product",
    functionName: "factorial",
    code: `long long __FN__(int number) {
  long long product = 1;
  for (int value = 2; value <= number; value++) {
    product *= value;
  }
  return product;
}`,
  },
  {
    slug: "prime-check",
    title: "Check a prime number",
    topic: "number theory",
    functionName: "is_prime",
    code: `bool __FN__(int number) {
  if (number < 2) return false;
  for (int divisor = 2; divisor <= number / divisor; divisor++) {
    if (number % divisor == 0) return false;
  }
  return true;
}`,
  },
  {
    slug: "prefix-sums",
    title: "Build prefix sums",
    topic: "prefix accumulation",
    functionName: "prefix_sums",
    code: `void __FN__(const int *values, size_t length, long long *prefix) {
  long long total = 0;
  for (size_t index = 0; index < length; index++) {
    total += values[index];
    prefix[index] = total;
  }
}`,
  },
  {
    slug: "maximum-subarray",
    title: "Find the best contiguous sum",
    topic: "dynamic programming",
    functionName: "maximum_subarray",
    code: `long long __FN__(const int *values, size_t length) {
  long long current = values[0];
  long long best = current;
  for (size_t index = 1; index < length; index++) {
    long long extended = current + values[index];
    current = values[index] > extended ? values[index] : extended;
    if (current > best) best = current;
  }
  return best;
}`,
  },
] as const;

const CSHARP: readonly CodeTemplate[] = [
  {
    slug: "linear-search",
    title: "Find a value by scanning",
    topic: "linear search",
    functionName: "LinearSearch",
    code: `int __FN__(int[] values, int target) {
  for (int index = 0; index < values.Length; index++) {
    if (values[index] == target) return index;
  }
  return -1;
}`,
  },
  {
    slug: "minimum",
    title: "Find the minimum",
    topic: "array scan",
    functionName: "FindMinimum",
    code: `int __FN__(int[] values) {
  int best = values[0];
  foreach (int value in values) {
    best = Math.Min(best, value);
  }
  return best;
}`,
  },
  {
    slug: "count-occurrences",
    title: "Count matching values",
    topic: "frequency scan",
    functionName: "CountOccurrences",
    code: `int __FN__(int[] values, int target) {
  int count = 0;
  foreach (int value in values) {
    if (value == target) count++;
  }
  return count;
}`,
  },
  {
    slug: "sorted-check",
    title: "Check sorted order",
    topic: "adjacent comparison",
    functionName: "IsSorted",
    code: `bool __FN__(int[] values) {
  for (int index = 1; index < values.Length; index++) {
    if (values[index] < values[index - 1]) return false;
  }
  return true;
}`,
  },
  {
    slug: "factorial",
    title: "Calculate a factorial",
    topic: "iterative product",
    functionName: "Factorial",
    code: `long __FN__(int number) {
  long product = 1;
  for (int value = 2; value <= number; value++) {
    product *= value;
  }
  return product;
}`,
  },
  {
    slug: "prime-check",
    title: "Check a prime number",
    topic: "number theory",
    functionName: "IsPrime",
    code: `bool __FN__(int number) {
  if (number < 2) return false;
  for (int divisor = 2; divisor <= number / divisor; divisor++) {
    if (number % divisor == 0) return false;
  }
  return true;
}`,
  },
  {
    slug: "prefix-sums",
    title: "Build prefix sums",
    topic: "prefix accumulation",
    functionName: "PrefixSums",
    code: `long[] __FN__(int[] values) {
  long[] prefix = new long[values.Length];
  long total = 0;
  for (int index = 0; index < values.Length; index++) {
    total += values[index];
    prefix[index] = total;
  }
  return prefix;
}`,
  },
  {
    slug: "maximum-subarray",
    title: "Find the best contiguous sum",
    topic: "dynamic programming",
    functionName: "MaximumSubarray",
    code: `long __FN__(int[] values) {
  long current = values[0];
  long best = current;
  for (int index = 1; index < values.Length; index++) {
    current = Math.Max(values[index], current + values[index]);
    best = Math.Max(best, current);
  }
  return best;
}`,
  },
] as const;

const JAVASCRIPT: readonly CodeTemplate[] = [
  {
    slug: "linear-search",
    title: "Find a value by scanning",
    topic: "linear search",
    functionName: "linearSearch",
    code: `function __FN__(values, target) {
  for (let index = 0; index < values.length; index++) {
    if (values[index] === target) return index;
  }
  return -1;
}`,
  },
  {
    slug: "minimum",
    title: "Find the minimum",
    topic: "array scan",
    functionName: "findMinimum",
    code: `function __FN__(values) {
  let best = values[0];
  for (const value of values) {
    best = Math.min(best, value);
  }
  return best;
}`,
  },
  {
    slug: "count-occurrences",
    title: "Count matching values",
    topic: "frequency scan",
    functionName: "countOccurrences",
    code: `function __FN__(values, target) {
  let count = 0;
  for (const value of values) {
    if (value === target) count++;
  }
  return count;
}`,
  },
  {
    slug: "sorted-check",
    title: "Check sorted order",
    topic: "adjacent comparison",
    functionName: "isSorted",
    code: `function __FN__(values) {
  for (let index = 1; index < values.length; index++) {
    if (values[index] < values[index - 1]) return false;
  }
  return true;
}`,
  },
  {
    slug: "factorial",
    title: "Calculate a factorial",
    topic: "iterative product",
    functionName: "factorial",
    code: `function __FN__(number) {
  let product = 1;
  for (let value = 2; value <= number; value++) {
    product *= value;
  }
  return product;
}`,
  },
  {
    slug: "prime-check",
    title: "Check a prime number",
    topic: "number theory",
    functionName: "isPrime",
    code: `function __FN__(number) {
  if (number < 2) return false;
  for (let divisor = 2; divisor <= Math.floor(number / divisor); divisor++) {
    if (number % divisor === 0) return false;
  }
  return true;
}`,
  },
  {
    slug: "prefix-sums",
    title: "Build prefix sums",
    topic: "prefix accumulation",
    functionName: "prefixSums",
    code: `function __FN__(values) {
  const prefix = [];
  let total = 0;
  for (const value of values) {
    total += value;
    prefix.push(total);
  }
  return prefix;
}`,
  },
  {
    slug: "maximum-subarray",
    title: "Find the best contiguous sum",
    topic: "dynamic programming",
    functionName: "maximumSubarray",
    code: `function __FN__(values) {
  let current = values[0];
  let best = current;
  for (let index = 1; index < values.length; index++) {
    const value = values[index];
    current = Math.max(value, current + value);
    best = Math.max(best, current);
  }
  return best;
}`,
  },
] as const;

function typedTemplate(
  index: number,
  transform: (code: string) => string,
): CodeTemplate {
  const template = JAVASCRIPT[index];
  if (template === undefined) {
    throw new Error(`Missing JavaScript expansion template ${String(index)}.`);
  }
  return { ...template, code: transform(template.code) };
}

const TYPESCRIPT: readonly CodeTemplate[] = [
  typedTemplate(0, (code) =>
    code.replace(
      "(values, target)",
      "(values: number[], target: number)",
    ),
  ),
  typedTemplate(1, (code) =>
    code.replace("(values)", "(values: number[])")
  ),
  typedTemplate(2, (code) =>
    code.replace(
      "(values, target)",
      "(values: number[], target: number)",
    ),
  ),
  typedTemplate(3, (code) =>
    code.replace("(values)", "(values: number[])")
  ),
  typedTemplate(4, (code) =>
    code.replace("(number)", "(number: number)")
  ),
  typedTemplate(5, (code) =>
    code.replace("(number)", "(number: number)")
  ),
  typedTemplate(6, (code) =>
    code
      .replace("(values)", "(values: number[]): number[]")
      .replace("const prefix = [];", "const prefix: number[] = [];")
  ),
  typedTemplate(7, (code) =>
    code.replace("(values)", "(values: number[])")
  ),
] as const;

const GO: readonly CodeTemplate[] = [
  {
    slug: "linear-search",
    title: "Find a value by scanning",
    topic: "linear search",
    functionName: "linearSearch",
    code: `func __FN__(values []int, target int) int {
  for index, value := range values {
    if value == target {
      return index
    }
  }
  return -1
}`,
  },
  {
    slug: "minimum",
    title: "Find the minimum",
    topic: "array scan",
    functionName: "findMinimum",
    code: `func __FN__(values []int) int {
  best := values[0]
  for _, value := range values {
    if value < best {
      best = value
    }
  }
  return best
}`,
  },
  {
    slug: "count-occurrences",
    title: "Count matching values",
    topic: "frequency scan",
    functionName: "countOccurrences",
    code: `func __FN__(values []int, target int) int {
  count := 0
  for _, value := range values {
    if value == target {
      count++
    }
  }
  return count
}`,
  },
  {
    slug: "sorted-check",
    title: "Check sorted order",
    topic: "adjacent comparison",
    functionName: "isSorted",
    code: `func __FN__(values []int) bool {
  for index := 1; index < len(values); index++ {
    if values[index] < values[index-1] {
      return false
    }
  }
  return true
}`,
  },
  {
    slug: "factorial",
    title: "Calculate a factorial",
    topic: "iterative product",
    functionName: "factorial",
    code: `func __FN__(number int) int64 {
  product := int64(1)
  for value := 2; value <= number; value++ {
    product *= int64(value)
  }
  return product
}`,
  },
  {
    slug: "prime-check",
    title: "Check a prime number",
    topic: "number theory",
    functionName: "isPrime",
    code: `func __FN__(number int) bool {
  if number < 2 {
    return false
  }
  for divisor := 2; divisor <= number/divisor; divisor++ {
    if number%divisor == 0 {
      return false
    }
  }
  return true
}`,
  },
  {
    slug: "prefix-sums",
    title: "Build prefix sums",
    topic: "prefix accumulation",
    functionName: "prefixSums",
    code: `func __FN__(values []int) []int64 {
  prefix := make([]int64, len(values))
  total := int64(0)
  for index, value := range values {
    total += int64(value)
    prefix[index] = total
  }
  return prefix
}`,
  },
  {
    slug: "maximum-subarray",
    title: "Find the best contiguous sum",
    topic: "dynamic programming",
    functionName: "maximumSubarray",
    code: `func __FN__(values []int) int {
  current := values[0]
  best := current
  for _, value := range values[1:] {
    if current+value > value {
      current += value
    } else {
      current = value
    }
    if current > best {
      best = current
    }
  }
  return best
}`,
  },
] as const;

export const EXPANDED_CODE_TEMPLATES: Readonly<
  Record<CodeLanguage, readonly CodeTemplate[]>
> = {
  cpp: CPP,
  java: JAVA,
  python3: PYTHON3,
  c: C,
  csharp: CSHARP,
  javascript: JAVASCRIPT,
  typescript: TYPESCRIPT,
  go: GO,
};
