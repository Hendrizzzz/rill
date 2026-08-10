import type { CodeLanguage } from "./types";
import type { CodeTemplate } from "./codeCorpusModel";

const CPP: readonly CodeTemplate[] = [
  { slug: "fibonacci", title: "Calculate a Fibonacci number", topic: "iterative dynamic programming", functionName: "fibonacci", code: `long long __FN__(int number) {
  long long previous = 0;
  long long current = 1;
  for (int step = 0; step < number; step++) {
    long long next = previous + current;
    previous = current;
    current = next;
  }
  return previous;
}` },
  { slug: "digit-sum", title: "Sum the digits", topic: "digit decomposition", functionName: "digitSum", code: `int __FN__(int number) {
  int total = 0;
  while (number > 0) {
    total += number % 10;
    number /= 10;
  }
  return total;
}` },
  { slug: "count-set-bits", title: "Count set bits", topic: "bit manipulation", functionName: "countSetBits", code: `int __FN__(unsigned int number) {
  int count = 0;
  while (number != 0) {
    number &= number - 1;
    count++;
  }
  return count;
}` },
  { slug: "lower-bound", title: "Find the first insertion point", topic: "binary search boundary", functionName: "lowerBound", code: `size_t __FN__(const vector<int>& values, int target) {
  size_t left = 0;
  size_t right = values.size();
  while (left < right) {
    size_t middle = left + (right - left) / 2;
    if (values[middle] < target) left = middle + 1;
    else right = middle;
  }
  return left;
}` },
  { slug: "second-largest", title: "Find the second distinct maximum", topic: "two-value tracking", functionName: "secondLargest", code: `int __FN__(const vector<int>& values) {
  int largest = values.front();
  int second = values.front();
  bool found = false;
  for (size_t index = 1; index < values.size(); index++) {
    int value = values[index];
    if (value > largest) {
      second = largest;
      largest = value;
      found = true;
    } else if (value < largest && (!found || value > second)) {
      second = value;
      found = true;
    }
  }
  return second;
}` },
  { slug: "majority-element", title: "Find the majority value", topic: "Boyer-Moore voting", functionName: "majorityElement", code: `int __FN__(const vector<int>& values) {
  int candidate = 0;
  int balance = 0;
  for (int value : values) {
    if (balance == 0) candidate = value;
    balance += value == candidate ? 1 : -1;
  }
  return candidate;
}` },
  { slug: "longest-increasing-run", title: "Measure the longest increasing run", topic: "contiguous sequence scan", functionName: "longestIncreasingRun", code: `size_t __FN__(const vector<int>& values) {
  if (values.empty()) return 0;
  size_t current = 1;
  size_t best = 1;
  for (size_t index = 1; index < values.size(); index++) {
    current = values[index] > values[index - 1] ? current + 1 : 1;
    best = max(best, current);
  }
  return best;
}` },
  { slug: "unique-count-sorted", title: "Count distinct sorted values", topic: "sorted transition scan", functionName: "countUniqueSorted", code: `size_t __FN__(const vector<int>& values) {
  if (values.empty()) return 0;
  size_t count = 1;
  for (size_t index = 1; index < values.size(); index++) {
    if (values[index] != values[index - 1]) count++;
  }
  return count;
}` },
] as const;

const JAVA: readonly CodeTemplate[] = [
  { slug: "fibonacci", title: "Calculate a Fibonacci number", topic: "iterative dynamic programming", functionName: "fibonacci", code: `long __FN__(int number) {
  long previous = 0;
  long current = 1;
  for (int step = 0; step < number; step++) {
    long next = previous + current;
    previous = current;
    current = next;
  }
  return previous;
}` },
  { slug: "digit-sum", title: "Sum the digits", topic: "digit decomposition", functionName: "digitSum", code: `int __FN__(int number) {
  int total = 0;
  while (number > 0) {
    total += number % 10;
    number /= 10;
  }
  return total;
}` },
  { slug: "count-set-bits", title: "Count set bits", topic: "bit manipulation", functionName: "countSetBits", code: `int __FN__(int number) {
  int count = 0;
  while (number != 0) {
    number &= number - 1;
    count++;
  }
  return count;
}` },
  { slug: "lower-bound", title: "Find the first insertion point", topic: "binary search boundary", functionName: "lowerBound", code: `int __FN__(int[] values, int target) {
  int left = 0;
  int right = values.length;
  while (left < right) {
    int middle = left + (right - left) / 2;
    if (values[middle] < target) left = middle + 1;
    else right = middle;
  }
  return left;
}` },
  { slug: "second-largest", title: "Find the second distinct maximum", topic: "two-value tracking", functionName: "secondLargest", code: `int __FN__(int[] values) {
  int largest = values[0];
  int second = values[0];
  boolean found = false;
  for (int index = 1; index < values.length; index++) {
    int value = values[index];
    if (value > largest) {
      second = largest;
      largest = value;
      found = true;
    } else if (value < largest && (!found || value > second)) {
      second = value;
      found = true;
    }
  }
  return second;
}` },
  { slug: "majority-element", title: "Find the majority value", topic: "Boyer-Moore voting", functionName: "majorityElement", code: `int __FN__(int[] values) {
  int candidate = 0;
  int balance = 0;
  for (int value : values) {
    if (balance == 0) candidate = value;
    balance += value == candidate ? 1 : -1;
  }
  return candidate;
}` },
  { slug: "longest-increasing-run", title: "Measure the longest increasing run", topic: "contiguous sequence scan", functionName: "longestIncreasingRun", code: `int __FN__(int[] values) {
  if (values.length == 0) return 0;
  int current = 1;
  int best = 1;
  for (int index = 1; index < values.length; index++) {
    current = values[index] > values[index - 1] ? current + 1 : 1;
    best = Math.max(best, current);
  }
  return best;
}` },
  { slug: "unique-count-sorted", title: "Count distinct sorted values", topic: "sorted transition scan", functionName: "countUniqueSorted", code: `int __FN__(int[] values) {
  if (values.length == 0) return 0;
  int count = 1;
  for (int index = 1; index < values.length; index++) {
    if (values[index] != values[index - 1]) count++;
  }
  return count;
}` },
] as const;

const PYTHON3: readonly CodeTemplate[] = [
  { slug: "fibonacci", title: "Calculate a Fibonacci number", topic: "iterative dynamic programming", functionName: "fibonacci", code: `def __FN__(number: int) -> int:
  previous = 0
  current = 1
  for _ in range(number):
    previous, current = current, previous + current
  return previous` },
  { slug: "digit-sum", title: "Sum the digits", topic: "digit decomposition", functionName: "digit_sum", code: `def __FN__(number: int) -> int:
  total = 0
  while number > 0:
    total += number % 10
    number //= 10
  return total` },
  { slug: "count-set-bits", title: "Count set bits", topic: "bit manipulation", functionName: "count_set_bits", code: `def __FN__(number: int) -> int:
  count = 0
  while number != 0:
    number &= number - 1
    count += 1
  return count` },
  { slug: "lower-bound", title: "Find the first insertion point", topic: "binary search boundary", functionName: "lower_bound", code: `def __FN__(values: list[int], target: int) -> int:
  left = 0
  right = len(values)
  while left < right:
    middle = left + (right - left) // 2
    if values[middle] < target:
      left = middle + 1
    else:
      right = middle
  return left` },
  { slug: "second-largest", title: "Find the second distinct maximum", topic: "two-value tracking", functionName: "second_largest", code: `def __FN__(values: list[int]) -> int:
  largest = values[0]
  second = values[0]
  found = False
  for index in range(1, len(values)):
    value = values[index]
    if value > largest:
      second = largest
      largest = value
      found = True
    elif value < largest and (not found or value > second):
      second = value
      found = True
  return second` },
  { slug: "majority-element", title: "Find the majority value", topic: "Boyer-Moore voting", functionName: "majority_element", code: `def __FN__(values: list[int]) -> int:
  candidate = 0
  balance = 0
  for value in values:
    if balance == 0:
      candidate = value
    balance += 1 if value == candidate else -1
  return candidate` },
  { slug: "longest-increasing-run", title: "Measure the longest increasing run", topic: "contiguous sequence scan", functionName: "longest_increasing_run", code: `def __FN__(values: list[int]) -> int:
  if not values:
    return 0
  current = 1
  best = 1
  for index in range(1, len(values)):
    current = current + 1 if values[index] > values[index - 1] else 1
    best = max(best, current)
  return best` },
  { slug: "unique-count-sorted", title: "Count distinct sorted values", topic: "sorted transition scan", functionName: "count_unique_sorted", code: `def __FN__(values: list[int]) -> int:
  if not values:
    return 0
  count = 1
  for index in range(1, len(values)):
    if values[index] != values[index - 1]:
      count += 1
  return count` },
] as const;

const C: readonly CodeTemplate[] = [
  { slug: "fibonacci", title: "Calculate a Fibonacci number", topic: "iterative dynamic programming", functionName: "fibonacci", code: `long long __FN__(int number) {
  long long previous = 0;
  long long current = 1;
  for (int step = 0; step < number; step++) {
    long long next = previous + current;
    previous = current;
    current = next;
  }
  return previous;
}` },
  { slug: "digit-sum", title: "Sum the digits", topic: "digit decomposition", functionName: "digit_sum", code: `int __FN__(int number) {
  int total = 0;
  while (number > 0) {
    total += number % 10;
    number /= 10;
  }
  return total;
}` },
  { slug: "count-set-bits", title: "Count set bits", topic: "bit manipulation", functionName: "count_set_bits", code: `int __FN__(unsigned int number) {
  int count = 0;
  while (number != 0) {
    number &= number - 1;
    count++;
  }
  return count;
}` },
  { slug: "lower-bound", title: "Find the first insertion point", topic: "binary search boundary", functionName: "lower_bound", code: `size_t __FN__(const int *values, size_t length, int target) {
  size_t left = 0;
  size_t right = length;
  while (left < right) {
    size_t middle = left + (right - left) / 2;
    if (values[middle] < target) left = middle + 1;
    else right = middle;
  }
  return left;
}` },
  { slug: "second-largest", title: "Find the second distinct maximum", topic: "two-value tracking", functionName: "second_largest", code: `int __FN__(const int *values, size_t length) {
  int largest = values[0];
  int second = values[0];
  bool found = false;
  for (size_t index = 1; index < length; index++) {
    int value = values[index];
    if (value > largest) {
      second = largest;
      largest = value;
      found = true;
    } else if (value < largest && (!found || value > second)) {
      second = value;
      found = true;
    }
  }
  return second;
}` },
  { slug: "majority-element", title: "Find the majority value", topic: "Boyer-Moore voting", functionName: "majority_element", code: `int __FN__(const int *values, size_t length) {
  int candidate = 0;
  int balance = 0;
  for (size_t index = 0; index < length; index++) {
    if (balance == 0) candidate = values[index];
    balance += values[index] == candidate ? 1 : -1;
  }
  return candidate;
}` },
  { slug: "longest-increasing-run", title: "Measure the longest increasing run", topic: "contiguous sequence scan", functionName: "longest_increasing_run", code: `size_t __FN__(const int *values, size_t length) {
  if (length == 0) return 0;
  size_t current = 1;
  size_t best = 1;
  for (size_t index = 1; index < length; index++) {
    current = values[index] > values[index - 1] ? current + 1 : 1;
    if (current > best) best = current;
  }
  return best;
}` },
  { slug: "unique-count-sorted", title: "Count distinct sorted values", topic: "sorted transition scan", functionName: "count_unique_sorted", code: `size_t __FN__(const int *values, size_t length) {
  if (length == 0) return 0;
  size_t count = 1;
  for (size_t index = 1; index < length; index++) {
    if (values[index] != values[index - 1]) count++;
  }
  return count;
}` },
] as const;

const CSHARP: readonly CodeTemplate[] = [
  { slug: "fibonacci", title: "Calculate a Fibonacci number", topic: "iterative dynamic programming", functionName: "Fibonacci", code: `long __FN__(int number) {
  long previous = 0;
  long current = 1;
  for (int step = 0; step < number; step++) {
    long next = previous + current;
    previous = current;
    current = next;
  }
  return previous;
}` },
  { slug: "digit-sum", title: "Sum the digits", topic: "digit decomposition", functionName: "DigitSum", code: `int __FN__(int number) {
  int total = 0;
  while (number > 0) {
    total += number % 10;
    number /= 10;
  }
  return total;
}` },
  { slug: "count-set-bits", title: "Count set bits", topic: "bit manipulation", functionName: "CountSetBits", code: `int __FN__(uint number) {
  int count = 0;
  while (number != 0) {
    number &= number - 1;
    count++;
  }
  return count;
}` },
  { slug: "lower-bound", title: "Find the first insertion point", topic: "binary search boundary", functionName: "LowerBound", code: `int __FN__(int[] values, int target) {
  int left = 0;
  int right = values.Length;
  while (left < right) {
    int middle = left + (right - left) / 2;
    if (values[middle] < target) left = middle + 1;
    else right = middle;
  }
  return left;
}` },
  { slug: "second-largest", title: "Find the second distinct maximum", topic: "two-value tracking", functionName: "SecondLargest", code: `int __FN__(int[] values) {
  int largest = values[0];
  int second = values[0];
  bool found = false;
  for (int index = 1; index < values.Length; index++) {
    int value = values[index];
    if (value > largest) {
      second = largest;
      largest = value;
      found = true;
    } else if (value < largest && (!found || value > second)) {
      second = value;
      found = true;
    }
  }
  return second;
}` },
  { slug: "majority-element", title: "Find the majority value", topic: "Boyer-Moore voting", functionName: "MajorityElement", code: `int __FN__(int[] values) {
  int candidate = 0;
  int balance = 0;
  foreach (int value in values) {
    if (balance == 0) candidate = value;
    balance += value == candidate ? 1 : -1;
  }
  return candidate;
}` },
  { slug: "longest-increasing-run", title: "Measure the longest increasing run", topic: "contiguous sequence scan", functionName: "LongestIncreasingRun", code: `int __FN__(int[] values) {
  if (values.Length == 0) return 0;
  int current = 1;
  int best = 1;
  for (int index = 1; index < values.Length; index++) {
    current = values[index] > values[index - 1] ? current + 1 : 1;
    best = Math.Max(best, current);
  }
  return best;
}` },
  { slug: "unique-count-sorted", title: "Count distinct sorted values", topic: "sorted transition scan", functionName: "CountUniqueSorted", code: `int __FN__(int[] values) {
  if (values.Length == 0) return 0;
  int count = 1;
  for (int index = 1; index < values.Length; index++) {
    if (values[index] != values[index - 1]) count++;
  }
  return count;
}` },
] as const;

const JAVASCRIPT: readonly CodeTemplate[] = [
  { slug: "fibonacci", title: "Calculate a Fibonacci number", topic: "iterative dynamic programming", functionName: "fibonacci", code: `function __FN__(number) {
  let previous = 0;
  let current = 1;
  for (let step = 0; step < number; step++) {
    [previous, current] = [current, previous + current];
  }
  return previous;
}` },
  { slug: "digit-sum", title: "Sum the digits", topic: "digit decomposition", functionName: "digitSum", code: `function __FN__(number) {
  let total = 0;
  while (number > 0) {
    total += number % 10;
    number = Math.floor(number / 10);
  }
  return total;
}` },
  { slug: "count-set-bits", title: "Count set bits", topic: "bit manipulation", functionName: "countSetBits", code: `function __FN__(number) {
  let count = 0;
  while (number !== 0) {
    number = (number & (number - 1)) >>> 0;
    count++;
  }
  return count;
}` },
  { slug: "lower-bound", title: "Find the first insertion point", topic: "binary search boundary", functionName: "lowerBound", code: `function __FN__(values, target) {
  let left = 0;
  let right = values.length;
  while (left < right) {
    const middle = left + Math.floor((right - left) / 2);
    if (values[middle] < target) left = middle + 1;
    else right = middle;
  }
  return left;
}` },
  { slug: "second-largest", title: "Find the second distinct maximum", topic: "two-value tracking", functionName: "secondLargest", code: `function __FN__(values) {
  let largest = values[0];
  let second = values[0];
  let found = false;
  for (let index = 1; index < values.length; index++) {
    const value = values[index];
    if (value > largest) {
      second = largest;
      largest = value;
      found = true;
    } else if (value < largest && (!found || value > second)) {
      second = value;
      found = true;
    }
  }
  return second;
}` },
  { slug: "majority-element", title: "Find the majority value", topic: "Boyer-Moore voting", functionName: "majorityElement", code: `function __FN__(values) {
  let candidate = 0;
  let balance = 0;
  for (const value of values) {
    if (balance === 0) candidate = value;
    balance += value === candidate ? 1 : -1;
  }
  return candidate;
}` },
  { slug: "longest-increasing-run", title: "Measure the longest increasing run", topic: "contiguous sequence scan", functionName: "longestIncreasingRun", code: `function __FN__(values) {
  if (values.length === 0) return 0;
  let current = 1;
  let best = 1;
  for (let index = 1; index < values.length; index++) {
    current = values[index] > values[index - 1] ? current + 1 : 1;
    best = Math.max(best, current);
  }
  return best;
}` },
  { slug: "unique-count-sorted", title: "Count distinct sorted values", topic: "sorted transition scan", functionName: "countUniqueSorted", code: `function __FN__(values) {
  if (values.length === 0) return 0;
  let count = 1;
  for (let index = 1; index < values.length; index++) {
    if (values[index] !== values[index - 1]) count++;
  }
  return count;
}` },
] as const;

const TYPESCRIPT: readonly CodeTemplate[] = JAVASCRIPT.map((template) => ({
  ...template,
  code: template.code
    .replace("function __FN__(number) {", "function __FN__(number: number): number {")
    .replace("function __FN__(values, target) {", "function __FN__(values: number[], target: number): number {")
    .replace("function __FN__(values) {", "function __FN__(values: number[]): number {")
    .replace("let largest = values[0];", "let largest = values[0]!;")
    .replace("let second = values[0];", "let second = values[0]!;"),
}));

const GO: readonly CodeTemplate[] = [
  { slug: "fibonacci", title: "Calculate a Fibonacci number", topic: "iterative dynamic programming", functionName: "fibonacci", code: `func __FN__(number int) int64 {
  previous := int64(0)
  current := int64(1)
  for step := 0; step < number; step++ {
    previous, current = current, previous+current
  }
  return previous
}` },
  { slug: "digit-sum", title: "Sum the digits", topic: "digit decomposition", functionName: "digitSum", code: `func __FN__(number int) int {
  total := 0
  for number > 0 {
    total += number % 10
    number /= 10
  }
  return total
}` },
  { slug: "count-set-bits", title: "Count set bits", topic: "bit manipulation", functionName: "countSetBits", code: `func __FN__(number uint) int {
  count := 0
  for number != 0 {
    number &= number - 1
    count++
  }
  return count
}` },
  { slug: "lower-bound", title: "Find the first insertion point", topic: "binary search boundary", functionName: "lowerBound", code: `func __FN__(values []int, target int) int {
  left := 0
  right := len(values)
  for left < right {
    middle := left + (right-left)/2
    if values[middle] < target {
      left = middle + 1
    } else {
      right = middle
    }
  }
  return left
}` },
  { slug: "second-largest", title: "Find the second distinct maximum", topic: "two-value tracking", functionName: "secondLargest", code: `func __FN__(values []int) int {
  largest := values[0]
  second := values[0]
  found := false
  for _, value := range values[1:] {
    if value > largest {
      second = largest
      largest = value
      found = true
    } else if value < largest && (!found || value > second) {
      second = value
      found = true
    }
  }
  return second
}` },
  { slug: "majority-element", title: "Find the majority value", topic: "Boyer-Moore voting", functionName: "majorityElement", code: `func __FN__(values []int) int {
  candidate := 0
  balance := 0
  for _, value := range values {
    if balance == 0 {
      candidate = value
    }
    if value == candidate {
      balance++
    } else {
      balance--
    }
  }
  return candidate
}` },
  { slug: "longest-increasing-run", title: "Measure the longest increasing run", topic: "contiguous sequence scan", functionName: "longestIncreasingRun", code: `func __FN__(values []int) int {
  if len(values) == 0 {
    return 0
  }
  current := 1
  best := 1
  for index := 1; index < len(values); index++ {
    if values[index] > values[index-1] {
      current++
    } else {
      current = 1
    }
    if current > best {
      best = current
    }
  }
  return best
}` },
  { slug: "unique-count-sorted", title: "Count distinct sorted values", topic: "sorted transition scan", functionName: "countUniqueSorted", code: `func __FN__(values []int) int {
  if len(values) == 0 {
    return 0
  }
  count := 1
  for index := 1; index < len(values); index++ {
    if values[index] != values[index-1] {
      count++
    }
  }
  return count
}` },
] as const;

export const MORE_CODE_TEMPLATES: Readonly<Record<CodeLanguage, readonly CodeTemplate[]>> = {
  cpp: CPP,
  java: JAVA,
  python3: PYTHON3,
  c: C,
  csharp: CSHARP,
  javascript: JAVASCRIPT,
  typescript: TYPESCRIPT,
  go: GO,
};
