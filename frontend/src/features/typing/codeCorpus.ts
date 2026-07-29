import type { CodeLanguage } from "./types";

// Keep this module runtime-self-contained: the corpus validator imports it from a
// data URL. This mirrors the editor's structural indentation contract.
const EMITTED_CODE_INDENT_WIDTH = 4;

export interface CodeLanguageOption {
  id: CodeLanguage;
  label: string;
  shortLabel: string;
  extension: string;
}

export interface CodeExercise {
  id: string;
  language: CodeLanguage;
  title: string;
  topic: string;
  lesson: string;
  assumptions: string;
  complexity: string;
  variation: number;
  code: string;
}

interface CodeTemplate {
  slug: string;
  title: string;
  topic: string;
  functionName: string;
  lesson?: string;
  assumptions?: string;
  complexity?: string;
  code: string;
}

export const CODE_LANGUAGES: readonly CodeLanguageOption[] = [
  { id: "cpp", label: "C++", shortLabel: "C++", extension: "cpp" },
  { id: "java", label: "Java", shortLabel: "Java", extension: "java" },
  {
    id: "python3",
    label: "Python 3",
    shortLabel: "Python",
    extension: "py",
  },
  { id: "c", label: "C", shortLabel: "C", extension: "c" },
  { id: "csharp", label: "C#", shortLabel: "C#", extension: "cs" },
  {
    id: "javascript",
    label: "JavaScript",
    shortLabel: "JS",
    extension: "js",
  },
  {
    id: "typescript",
    label: "TypeScript",
    shortLabel: "TS",
    extension: "ts",
  },
  { id: "go", label: "Go", shortLabel: "Go", extension: "go" },
] as const;

const CPP_TEMPLATES: readonly CodeTemplate[] = [
  {
    slug: "contains-duplicate",
    title: "Detect a repeated value",
    topic: "hash set",
    functionName: "containsDuplicate",
    code: `bool __FN__(const vector<int>& values) {
  unordered_set<int> seen;
  for (int value : values) {
    if (!seen.insert(value).second) return true;
  }
  return false;
}`,
  },
  {
    slug: "palindrome",
    title: "Check a palindrome",
    topic: "two pointers",
    functionName: "isPalindrome",
    code: `bool __FN__(const string& text) {
  int left = 0;
  int right = static_cast<int>(text.size()) - 1;
  while (left < right) {
    if (text[left++] != text[right--]) return false;
  }
  return true;
}`,
  },
  {
    slug: "reverse-string",
    title: "Reverse a string",
    topic: "two pointers",
    functionName: "reverseText",
    code: `string __FN__(string text) {
  int left = 0;
  int right = static_cast<int>(text.size()) - 1;
  while (left < right) {
    swap(text[left++], text[right--]);
  }
  return text;
}`,
  },
  {
    slug: "array-sum",
    title: "Sum an array",
    topic: "array scan",
    functionName: "arraySum",
    code: `long long __FN__(const vector<int>& values) {
  long long total = 0;
  for (int value : values) {
    total += value;
  }
  return total;
}`,
  },
  {
    slug: "maximum",
    title: "Find the maximum",
    topic: "array scan",
    functionName: "findMaximum",
    code: `int __FN__(const vector<int>& values) {
  int best = values.front();
  for (int value : values) {
    best = max(best, value);
  }
  return best;
}`,
  },
  {
    slug: "count-vowels",
    title: "Count vowels",
    topic: "string scan",
    functionName: "countVowels",
    code: `int __FN__(const string& text) {
  int count = 0;
  for (char value : text) {
    char lower = static_cast<char>(tolower(static_cast<unsigned char>(value)));
    if (string("aeiou").find(lower) != string::npos) count++;
  }
  return count;
}`,
  },
  {
    slug: "binary-search",
    title: "Binary search",
    topic: "search",
    functionName: "binarySearch",
    code: `int __FN__(const vector<int>& values, int target) {
  int left = 0;
  int right = static_cast<int>(values.size()) - 1;
  while (left <= right) {
    int middle = left + (right - left) / 2;
    if (values[middle] == target) return middle;
    if (values[middle] < target) left = middle + 1;
    else right = middle - 1;
  }
  return -1;
}`,
  },
  {
    slug: "two-sum",
    title: "Find a pair with a target sum",
    topic: "hash map",
    functionName: "pairForSum",
    code: `vector<int> __FN__(const vector<int>& values, int target) {
  unordered_map<int, int> seen;
  for (size_t index = 0; index < values.size(); index++) {
    int needed = target - values[index];
    if (seen.count(needed)) {
      return {seen[needed], static_cast<int>(index)};
    }
    seen[values[index]] = static_cast<int>(index);
  }
  return {};
}`,
  },
  {
    slug: "valid-brackets",
    title: "Validate brackets",
    topic: "stack",
    functionName: "validBrackets",
    code: `bool __FN__(const string& text) {
  stack<char> opened;
  unordered_map<char, char> pairs = {{')', '('}, {']', '['}, {'}', '{'}};
  for (char value : text) {
    if (!pairs.count(value)) opened.push(value);
    else if (opened.empty() || opened.top() != pairs[value]) return false;
    else opened.pop();
  }
  return opened.empty();
}`,
  },
  {
    slug: "merge-sorted",
    title: "Merge sorted arrays",
    topic: "two pointers",
    functionName: "mergeSorted",
    code: `vector<int> __FN__(const vector<int>& left, const vector<int>& right) {
  vector<int> merged;
  size_t first = 0;
  size_t second = 0;
  while (first < left.size() && second < right.size()) {
    if (left[first] <= right[second]) merged.push_back(left[first++]);
    else merged.push_back(right[second++]);
  }
  merged.insert(merged.end(), left.begin() + first, left.end());
  merged.insert(merged.end(), right.begin() + second, right.end());
  return merged;
}`,
  },
  {
    slug: "move-zeroes",
    title: "Move zeroes to the end",
    topic: "two pointers",
    functionName: "moveZeroes",
    code: `void __FN__(vector<int>& values) {
  size_t write = 0;
  for (int value : values) {
    if (value != 0) values[write++] = value;
  }
  while (write < values.size()) {
    values[write++] = 0;
  }
}`,
  },
  {
    slug: "missing-number",
    title: "Find the missing number",
    topic: "exclusive or",
    functionName: "missingNumber",
    code: `int __FN__(const vector<int>& values) {
  int missing = static_cast<int>(values.size());
  for (size_t index = 0; index < values.size(); index++) {
    missing ^= static_cast<int>(index) ^ values[index];
  }
  return missing;
}`,
  },
  {
    slug: "anagram",
    title: "Check an anagram",
    topic: "frequency count",
    functionName: "isAnagram",
    code: `bool __FN__(const string& first, const string& second) {
  if (first.size() != second.size()) return false;
  array<int, 26> counts{};
  for (char value : first) counts[value - 'a']++;
  for (char value : second) counts[value - 'a']--;
  return all_of(counts.begin(), counts.end(), [](int count) {
    return count == 0;
  });
}`,
  },
  {
    slug: "first-unique",
    title: "Find the first unique character",
    topic: "frequency count",
    functionName: "firstUnique",
    code: `int __FN__(const string& text) {
  array<int, 26> counts{};
  for (char value : text) counts[value - 'a']++;
  for (size_t index = 0; index < text.size(); index++) {
    if (counts[text[index] - 'a'] == 1) {
      return static_cast<int>(index);
    }
  }
  return -1;
}`,
  },
  {
    slug: "gcd",
    title: "Greatest common divisor",
    topic: "number theory",
    functionName: "greatestDivisor",
    code: `int __FN__(int first, int second) {
  while (second != 0) {
    int remainder = first % second;
    first = second;
    second = remainder;
  }
  return abs(first);
}`,
  },
  {
    slug: "climb-stairs",
    title: "Count stair-climbing paths",
    topic: "dynamic programming",
    functionName: "climbStairs",
    code: `int __FN__(int steps) {
  int previous = 0;
  int current = 1;
  for (int step = 0; step < steps; step++) {
    tie(previous, current) = pair{current, previous + current};
  }
  return current;
}`,
  },
] as const;

const JAVA_TEMPLATES: readonly CodeTemplate[] = [
  {
    slug: "contains-duplicate",
    title: "Detect a repeated value",
    topic: "hash set",
    functionName: "containsDuplicate",
    code: `boolean __FN__(int[] values) {
  Set<Integer> seen = new HashSet<>();
  for (int value : values) {
    if (!seen.add(value)) return true;
  }
  return false;
}`,
  },
  {
    slug: "palindrome",
    title: "Check a palindrome",
    topic: "two pointers",
    functionName: "isPalindrome",
    code: `boolean __FN__(String text) {
  int left = 0;
  int right = text.length() - 1;
  while (left < right) {
    if (text.charAt(left++) != text.charAt(right--)) return false;
  }
  return true;
}`,
  },
  {
    slug: "reverse-string",
    title: "Reverse a string",
    topic: "two pointers",
    functionName: "reverseText",
    code: `String __FN__(String text) {
  char[] values = text.toCharArray();
  int left = 0;
  int right = values.length - 1;
  while (left < right) {
    char saved = values[left];
    values[left++] = values[right];
    values[right--] = saved;
  }
  return new String(values);
}`,
  },
  {
    slug: "array-sum",
    title: "Sum an array",
    topic: "array scan",
    functionName: "arraySum",
    code: `long __FN__(int[] values) {
  long total = 0;
  for (int value : values) {
    total += value;
  }
  return total;
}`,
  },
  {
    slug: "maximum",
    title: "Find the maximum",
    topic: "array scan",
    functionName: "findMaximum",
    code: `int __FN__(int[] values) {
  int best = values[0];
  for (int value : values) {
    best = Math.max(best, value);
  }
  return best;
}`,
  },
  {
    slug: "count-vowels",
    title: "Count vowels",
    topic: "string scan",
    functionName: "countVowels",
    code: `int __FN__(String text) {
  int count = 0;
  for (int index = 0; index < text.length(); index++) {
    char value = Character.toLowerCase(text.charAt(index));
    if ("aeiou".indexOf(value) >= 0) count++;
  }
  return count;
}`,
  },
  {
    slug: "binary-search",
    title: "Binary search",
    topic: "search",
    functionName: "binarySearch",
    code: `int __FN__(int[] values, int target) {
  int left = 0;
  int right = values.length - 1;
  while (left <= right) {
    int middle = left + (right - left) / 2;
    if (values[middle] == target) return middle;
    if (values[middle] < target) left = middle + 1;
    else right = middle - 1;
  }
  return -1;
}`,
  },
  {
    slug: "two-sum",
    title: "Find a pair with a target sum",
    topic: "hash map",
    functionName: "pairForSum",
    code: `int[] __FN__(int[] values, int target) {
  Map<Integer, Integer> seen = new HashMap<>();
  for (int index = 0; index < values.length; index++) {
    int needed = target - values[index];
    if (seen.containsKey(needed)) return new int[] {seen.get(needed), index};
    seen.put(values[index], index);
  }
  return new int[0];
}`,
  },
  {
    slug: "valid-brackets",
    title: "Validate brackets",
    topic: "stack",
    functionName: "validBrackets",
    code: `boolean __FN__(String text) {
  Deque<Character> opened = new ArrayDeque<>();
  Map<Character, Character> pairs = Map.of(')', '(', ']', '[', '}', '{');
  for (char value : text.toCharArray()) {
    if (!pairs.containsKey(value)) opened.push(value);
    else if (opened.isEmpty() || opened.pop() != pairs.get(value)) return false;
  }
  return opened.isEmpty();
}`,
  },
  {
    slug: "merge-sorted",
    title: "Merge sorted arrays",
    topic: "two pointers",
    functionName: "mergeSorted",
    code: `int[] __FN__(int[] left, int[] right) {
  int[] merged = new int[left.length + right.length];
  int first = 0;
  int second = 0;
  int write = 0;
  while (first < left.length && second < right.length) {
    merged[write++] = left[first] <= right[second] ? left[first++] : right[second++];
  }
  while (first < left.length) merged[write++] = left[first++];
  while (second < right.length) merged[write++] = right[second++];
  return merged;
}`,
  },
  {
    slug: "move-zeroes",
    title: "Move zeroes to the end",
    topic: "two pointers",
    functionName: "moveZeroes",
    code: `void __FN__(int[] values) {
  int write = 0;
  for (int value : values) {
    if (value != 0) values[write++] = value;
  }
  while (write < values.length) {
    values[write++] = 0;
  }
}`,
  },
  {
    slug: "missing-number",
    title: "Find the missing number",
    topic: "exclusive or",
    functionName: "missingNumber",
    code: `int __FN__(int[] values) {
  int missing = values.length;
  for (int index = 0; index < values.length; index++) {
    missing ^= index ^ values[index];
  }
  return missing;
}`,
  },
  {
    slug: "anagram",
    title: "Check an anagram",
    topic: "frequency count",
    functionName: "isAnagram",
    code: `boolean __FN__(String first, String second) {
  if (first.length() != second.length()) return false;
  int[] counts = new int[26];
  for (char value : first.toCharArray()) counts[value - 'a']++;
  for (char value : second.toCharArray()) counts[value - 'a']--;
  for (int count : counts) {
    if (count != 0) return false;
  }
  return true;
}`,
  },
  {
    slug: "first-unique",
    title: "Find the first unique character",
    topic: "frequency count",
    functionName: "firstUnique",
    code: `int __FN__(String text) {
  int[] counts = new int[26];
  for (char value : text.toCharArray()) counts[value - 'a']++;
  for (int index = 0; index < text.length(); index++) {
    if (counts[text.charAt(index) - 'a'] == 1) return index;
  }
  return -1;
}`,
  },
  {
    slug: "gcd",
    title: "Greatest common divisor",
    topic: "number theory",
    functionName: "greatestDivisor",
    code: `int __FN__(int first, int second) {
  while (second != 0) {
    int remainder = first % second;
    first = second;
    second = remainder;
  }
  return Math.abs(first);
}`,
  },
  {
    slug: "climb-stairs",
    title: "Count stair-climbing paths",
    topic: "dynamic programming",
    functionName: "climbStairs",
    code: `int __FN__(int steps) {
  int previous = 0;
  int current = 1;
  for (int step = 0; step < steps; step++) {
    int next = previous + current;
    previous = current;
    current = next;
  }
  return current;
}`,
  },
] as const;

const PYTHON_TEMPLATES: readonly CodeTemplate[] = [
  {
    slug: "contains-duplicate",
    title: "Detect a repeated value",
    topic: "hash set",
    functionName: "contains_duplicate",
    code: `def __FN__(values: list[int]) -> bool:
  seen: set[int] = set()
  for value in values:
    if value in seen:
      return True
    seen.add(value)
  return False`,
  },
  {
    slug: "palindrome",
    title: "Check a palindrome",
    topic: "two pointers",
    functionName: "is_palindrome",
    code: `def __FN__(text: str) -> bool:
  left = 0
  right = len(text) - 1
  while left < right:
    if text[left] != text[right]:
      return False
    left += 1
    right -= 1
  return True`,
  },
  {
    slug: "reverse-string",
    title: "Reverse a string",
    topic: "two pointers",
    functionName: "reverse_text",
    code: `def __FN__(text: str) -> str:
  values = list(text)
  left = 0
  right = len(values) - 1
  while left < right:
    values[left], values[right] = values[right], values[left]
    left += 1
    right -= 1
  return "".join(values)`,
  },
  {
    slug: "array-sum",
    title: "Sum an array",
    topic: "array scan",
    functionName: "array_sum",
    code: `def __FN__(values: list[int]) -> int:
  total = 0
  for value in values:
    total += value
  return total`,
  },
  {
    slug: "maximum",
    title: "Find the maximum",
    topic: "array scan",
    functionName: "find_maximum",
    code: `def __FN__(values: list[int]) -> int:
  best = values[0]
  for value in values:
    best = max(best, value)
  return best`,
  },
  {
    slug: "count-vowels",
    title: "Count vowels",
    topic: "string scan",
    functionName: "count_vowels",
    code: `def __FN__(text: str) -> int:
  count = 0
  for value in text:
    if value.lower() in "aeiou":
      count += 1
  return count`,
  },
  {
    slug: "binary-search",
    title: "Binary search",
    topic: "search",
    functionName: "binary_search",
    code: `def __FN__(values: list[int], target: int) -> int:
  left = 0
  right = len(values) - 1
  while left <= right:
    middle = left + (right - left) // 2
    if values[middle] == target:
      return middle
    if values[middle] < target:
      left = middle + 1
    else:
      right = middle - 1
  return -1`,
  },
  {
    slug: "two-sum",
    title: "Find a pair with a target sum",
    topic: "hash map",
    functionName: "pair_for_sum",
    code: `def __FN__(values: list[int], target: int) -> list[int]:
  seen: dict[int, int] = {}
  for index, value in enumerate(values):
    needed = target - value
    if needed in seen:
      return [seen[needed], index]
    seen[value] = index
  return []`,
  },
  {
    slug: "valid-brackets",
    title: "Validate brackets",
    topic: "stack",
    functionName: "valid_brackets",
    code: `def __FN__(text: str) -> bool:
  opened: list[str] = []
  pairs = {")": "(", "]": "[", "}": "{"}
  for value in text:
    if value not in pairs:
      opened.append(value)
    elif not opened or opened.pop() != pairs[value]:
      return False
  return not opened`,
  },
  {
    slug: "merge-sorted",
    title: "Merge sorted arrays",
    topic: "two pointers",
    functionName: "merge_sorted",
    code: `def __FN__(left: list[int], right: list[int]) -> list[int]:
  merged: list[int] = []
  first = 0
  second = 0
  while first < len(left) and second < len(right):
    if left[first] <= right[second]:
      merged.append(left[first])
      first += 1
    else:
      merged.append(right[second])
      second += 1
  return merged + left[first:] + right[second:]`,
  },
  {
    slug: "move-zeroes",
    title: "Move zeroes to the end",
    topic: "two pointers",
    functionName: "move_zeroes",
    code: `def __FN__(values: list[int]) -> None:
  write = 0
  for value in values:
    if value != 0:
      values[write] = value
      write += 1
  while write < len(values):
    values[write] = 0
    write += 1`,
  },
  {
    slug: "missing-number",
    title: "Find the missing number",
    topic: "exclusive or",
    functionName: "missing_number",
    code: `def __FN__(values: list[int]) -> int:
  missing = len(values)
  for index, value in enumerate(values):
    missing ^= index ^ value
  return missing`,
  },
  {
    slug: "anagram",
    title: "Check an anagram",
    topic: "frequency count",
    functionName: "is_anagram",
    code: `def __FN__(first: str, second: str) -> bool:
  if len(first) != len(second):
    return False
  counts: dict[str, int] = {}
  for value in first:
    counts[value] = counts.get(value, 0) + 1
  for value in second:
    counts[value] = counts.get(value, 0) - 1
  return all(count == 0 for count in counts.values())`,
  },
  {
    slug: "first-unique",
    title: "Find the first unique character",
    topic: "frequency count",
    functionName: "first_unique",
    code: `def __FN__(text: str) -> int:
  counts: dict[str, int] = {}
  for value in text:
    counts[value] = counts.get(value, 0) + 1
  for index, value in enumerate(text):
    if counts[value] == 1:
      return index
  return -1`,
  },
  {
    slug: "gcd",
    title: "Greatest common divisor",
    topic: "number theory",
    functionName: "greatest_divisor",
    code: `def __FN__(first: int, second: int) -> int:
  while second != 0:
    first, second = second, first % second
  return abs(first)`,
  },
  {
    slug: "climb-stairs",
    title: "Count stair-climbing paths",
    topic: "dynamic programming",
    functionName: "climb_stairs",
    code: `def __FN__(steps: int) -> int:
  previous = 0
  current = 1
  for _ in range(steps):
    previous, current = current, previous + current
  return current`,
  },
] as const;

const C_TEMPLATES: readonly CodeTemplate[] = [
  {
    slug: "contains-duplicate",
    title: "Detect a repeated value",
    topic: "array scan",
    functionName: "contains_duplicate",
    lesson:
      "Compare each value only with the entries that follow it; this trades speed for constant extra space.",
    assumptions: "pairwise comparisons use no hash table",
    complexity: "O(n²) time · O(1) space",
    code: `bool __FN__(const int *values, int size) {
  for (int left = 0; left < size; left++) {
    for (int right = left + 1; right < size; right++) {
      if (values[left] == values[right]) return true;
    }
  }
  return false;
}`,
  },
  {
    slug: "palindrome",
    title: "Check a palindrome",
    topic: "two pointers",
    functionName: "is_palindrome",
    code: `bool __FN__(const char *text) {
  int left = 0;
  int right = (int) strlen(text) - 1;
  while (left < right) {
    if (text[left++] != text[right--]) return false;
  }
  return true;
}`,
  },
  {
    slug: "reverse-string",
    title: "Reverse a string",
    topic: "two pointers",
    functionName: "reverse_text",
    complexity: "O(n) time · O(1) space",
    code: `void __FN__(char *text) {
  int left = 0;
  int right = (int) strlen(text) - 1;
  while (left < right) {
    char saved = text[left];
    text[left++] = text[right];
    text[right--] = saved;
  }
}`,
  },
  {
    slug: "array-sum",
    title: "Sum an array",
    topic: "array scan",
    functionName: "array_sum",
    code: `long long __FN__(const int *values, int size) {
  long long total = 0;
  for (int index = 0; index < size; index++) {
    total += values[index];
  }
  return total;
}`,
  },
  {
    slug: "maximum",
    title: "Find the maximum",
    topic: "array scan",
    functionName: "find_maximum",
    code: `int __FN__(const int *values, int size) {
  int best = values[0];
  for (int index = 1; index < size; index++) {
    if (values[index] > best) best = values[index];
  }
  return best;
}`,
  },
  {
    slug: "count-vowels",
    title: "Count vowels",
    topic: "string scan",
    functionName: "count_vowels",
    code: `int __FN__(const char *text) {
  int count = 0;
  for (int index = 0; text[index] != '\\0'; index++) {
    char value = (char) tolower((unsigned char) text[index]);
    if (strchr("aeiou", value) != NULL) count++;
  }
  return count;
}`,
  },
  {
    slug: "binary-search",
    title: "Binary search",
    topic: "search",
    functionName: "binary_search",
    code: `int __FN__(const int *values, int size, int target) {
  int left = 0;
  int right = size - 1;
  while (left <= right) {
    int middle = left + (right - left) / 2;
    if (values[middle] == target) return middle;
    if (values[middle] < target) left = middle + 1;
    else right = middle - 1;
  }
  return -1;
}`,
  },
  {
    slug: "two-sum",
    title: "Find a pair with a target sum",
    topic: "nested scan",
    functionName: "pair_for_sum",
    lesson:
      "Try each unordered pair once; return as soon as its sum matches the target.",
    assumptions: "integer sums fit the declared type",
    complexity: "O(n²) time · O(1) space",
    code: `bool __FN__(const int *values, int size, int target, int *answer) {
  for (int left = 0; left < size; left++) {
    for (int right = left + 1; right < size; right++) {
      if (values[left] + values[right] == target) {
        answer[0] = left;
        answer[1] = right;
        return true;
      }
    }
  }
  return false;
}`,
  },
  {
    slug: "valid-brackets",
    title: "Validate brackets",
    topic: "stack",
    functionName: "valid_brackets",
    code: `bool __FN__(const char *text) {
  int length = (int) strlen(text);
  char opened[length + 1];
  int top = 0;
  for (int index = 0; text[index] != '\\0'; index++) {
    char value = text[index];
    if (value == '(' || value == '[' || value == '{') opened[top++] = value;
    else if (value == ')' || value == ']' || value == '}') {
      if (top == 0) return false;
      char expected = value == ')' ? '(' : value == ']' ? '[' : '{';
      if (opened[--top] != expected) return false;
    } else return false;
  }
  return top == 0;
}`,
  },
  {
    slug: "merge-sorted",
    title: "Merge sorted arrays",
    topic: "two pointers",
    functionName: "merge_sorted",
    code: `void __FN__(const int *left, int left_size, const int *right, int right_size, int *merged) {
  int first = 0;
  int second = 0;
  int write = 0;
  while (first < left_size && second < right_size) {
    merged[write++] = left[first] <= right[second] ? left[first++] : right[second++];
  }
  while (first < left_size) merged[write++] = left[first++];
  while (second < right_size) merged[write++] = right[second++];
}`,
  },
  {
    slug: "move-zeroes",
    title: "Move zeroes to the end",
    topic: "two pointers",
    functionName: "move_zeroes",
    code: `void __FN__(int *values, int size) {
  int write = 0;
  for (int index = 0; index < size; index++) {
    if (values[index] != 0) values[write++] = values[index];
  }
  while (write < size) {
    values[write++] = 0;
  }
}`,
  },
  {
    slug: "missing-number",
    title: "Find the missing number",
    topic: "exclusive or",
    functionName: "missing_number",
    code: `int __FN__(const int *values, int size) {
  int missing = size;
  for (int index = 0; index < size; index++) {
    missing ^= index ^ values[index];
  }
  return missing;
}`,
  },
  {
    slug: "anagram",
    title: "Check an anagram",
    topic: "frequency count",
    functionName: "is_anagram",
    code: `bool __FN__(const char *first, const char *second) {
  int counts[26] = {0};
  for (int index = 0; first[index] != '\\0'; index++) counts[first[index] - 'a']++;
  for (int index = 0; second[index] != '\\0'; index++) counts[second[index] - 'a']--;
  for (int index = 0; index < 26; index++) {
    if (counts[index] != 0) return false;
  }
  return true;
}`,
  },
  {
    slug: "first-unique",
    title: "Find the first unique character",
    topic: "frequency count",
    functionName: "first_unique",
    code: `int __FN__(const char *text) {
  int counts[26] = {0};
  for (int index = 0; text[index] != '\\0'; index++) counts[text[index] - 'a']++;
  for (int index = 0; text[index] != '\\0'; index++) {
    if (counts[text[index] - 'a'] == 1) return index;
  }
  return -1;
}`,
  },
  {
    slug: "gcd",
    title: "Greatest common divisor",
    topic: "number theory",
    functionName: "greatest_divisor",
    code: `int __FN__(int first, int second) {
  while (second != 0) {
    int remainder = first % second;
    first = second;
    second = remainder;
  }
  return abs(first);
}`,
  },
  {
    slug: "climb-stairs",
    title: "Count stair-climbing paths",
    topic: "dynamic programming",
    functionName: "climb_stairs",
    code: `int __FN__(int steps) {
  int previous = 0;
  int current = 1;
  for (int step = 0; step < steps; step++) {
    int next = previous + current;
    previous = current;
    current = next;
  }
  return current;
}`,
  },
] as const;

const CSHARP_TEMPLATES: readonly CodeTemplate[] = [
  {
    slug: "contains-duplicate",
    title: "Detect a repeated value",
    topic: "hash set",
    functionName: "ContainsDuplicate",
    code: `bool __FN__(int[] values) {
  var seen = new HashSet<int>();
  foreach (int value in values) {
    if (!seen.Add(value)) return true;
  }
  return false;
}`,
  },
  {
    slug: "palindrome",
    title: "Check a palindrome",
    topic: "two pointers",
    functionName: "IsPalindrome",
    code: `bool __FN__(string text) {
  int left = 0;
  int right = text.Length - 1;
  while (left < right) {
    if (text[left++] != text[right--]) return false;
  }
  return true;
}`,
  },
  {
    slug: "reverse-string",
    title: "Reverse a string",
    topic: "two pointers",
    functionName: "ReverseText",
    code: `string __FN__(string text) {
  char[] values = text.ToCharArray();
  int left = 0;
  int right = values.Length - 1;
  while (left < right) {
    (values[left], values[right]) = (values[right], values[left]);
    left++;
    right--;
  }
  return new string(values);
}`,
  },
  {
    slug: "array-sum",
    title: "Sum an array",
    topic: "array scan",
    functionName: "ArraySum",
    code: `long __FN__(int[] values) {
  long total = 0;
  foreach (int value in values) {
    total += value;
  }
  return total;
}`,
  },
  {
    slug: "maximum",
    title: "Find the maximum",
    topic: "array scan",
    functionName: "FindMaximum",
    code: `int __FN__(int[] values) {
  int best = values[0];
  foreach (int value in values) {
    best = Math.Max(best, value);
  }
  return best;
}`,
  },
  {
    slug: "count-vowels",
    title: "Count vowels",
    topic: "string scan",
    functionName: "CountVowels",
    code: `int __FN__(string text) {
  int count = 0;
  foreach (char value in text) {
    char lower = char.ToLowerInvariant(value);
    if ("aeiou".Contains(lower)) count++;
  }
  return count;
}`,
  },
  {
    slug: "binary-search",
    title: "Binary search",
    topic: "search",
    functionName: "BinarySearch",
    code: `int __FN__(int[] values, int target) {
  int left = 0;
  int right = values.Length - 1;
  while (left <= right) {
    int middle = left + (right - left) / 2;
    if (values[middle] == target) return middle;
    if (values[middle] < target) left = middle + 1;
    else right = middle - 1;
  }
  return -1;
}`,
  },
  {
    slug: "two-sum",
    title: "Find a pair with a target sum",
    topic: "hash map",
    functionName: "PairForSum",
    code: `int[] __FN__(int[] values, int target) {
  var seen = new Dictionary<int, int>();
  for (int index = 0; index < values.Length; index++) {
    int needed = target - values[index];
    if (seen.TryGetValue(needed, out int match)) return new[] {match, index};
    seen[values[index]] = index;
  }
  return Array.Empty<int>();
}`,
  },
  {
    slug: "valid-brackets",
    title: "Validate brackets",
    topic: "stack",
    functionName: "ValidBrackets",
    code: `bool __FN__(string text) {
  var opened = new Stack<char>();
  var pairs = new Dictionary<char, char> {{')', '('}, {']', '['}, {'}', '{'}};
  foreach (char value in text) {
    if (!pairs.ContainsKey(value)) opened.Push(value);
    else if (opened.Count == 0 || opened.Pop() != pairs[value]) return false;
  }
  return opened.Count == 0;
}`,
  },
  {
    slug: "merge-sorted",
    title: "Merge sorted arrays",
    topic: "two pointers",
    functionName: "MergeSorted",
    code: `int[] __FN__(int[] left, int[] right) {
  int[] merged = new int[left.Length + right.Length];
  int first = 0;
  int second = 0;
  int write = 0;
  while (first < left.Length && second < right.Length) {
    merged[write++] = left[first] <= right[second] ? left[first++] : right[second++];
  }
  while (first < left.Length) merged[write++] = left[first++];
  while (second < right.Length) merged[write++] = right[second++];
  return merged;
}`,
  },
  {
    slug: "move-zeroes",
    title: "Move zeroes to the end",
    topic: "two pointers",
    functionName: "MoveZeroes",
    code: `void __FN__(int[] values) {
  int write = 0;
  foreach (int value in values) {
    if (value != 0) values[write++] = value;
  }
  while (write < values.Length) {
    values[write++] = 0;
  }
}`,
  },
  {
    slug: "missing-number",
    title: "Find the missing number",
    topic: "exclusive or",
    functionName: "MissingNumber",
    code: `int __FN__(int[] values) {
  int missing = values.Length;
  for (int index = 0; index < values.Length; index++) {
    missing ^= index ^ values[index];
  }
  return missing;
}`,
  },
  {
    slug: "anagram",
    title: "Check an anagram",
    topic: "frequency count",
    functionName: "IsAnagram",
    code: `bool __FN__(string first, string second) {
  if (first.Length != second.Length) return false;
  int[] counts = new int[26];
  foreach (char value in first) counts[value - 'a']++;
  foreach (char value in second) counts[value - 'a']--;
  return counts.All(count => count == 0);
}`,
  },
  {
    slug: "first-unique",
    title: "Find the first unique character",
    topic: "frequency count",
    functionName: "FirstUnique",
    code: `int __FN__(string text) {
  int[] counts = new int[26];
  foreach (char value in text) counts[value - 'a']++;
  for (int index = 0; index < text.Length; index++) {
    if (counts[text[index] - 'a'] == 1) return index;
  }
  return -1;
}`,
  },
  {
    slug: "gcd",
    title: "Greatest common divisor",
    topic: "number theory",
    functionName: "GreatestDivisor",
    code: `int __FN__(int first, int second) {
  while (second != 0) {
    int remainder = first % second;
    first = second;
    second = remainder;
  }
  return Math.Abs(first);
}`,
  },
  {
    slug: "climb-stairs",
    title: "Count stair-climbing paths",
    topic: "dynamic programming",
    functionName: "ClimbStairs",
    code: `int __FN__(int steps) {
  int previous = 0;
  int current = 1;
  for (int step = 0; step < steps; step++) {
    (previous, current) = (current, previous + current);
  }
  return current;
}`,
  },
] as const;

const JAVASCRIPT_TEMPLATES: readonly CodeTemplate[] = [
  {
    slug: "contains-duplicate",
    title: "Detect a repeated value",
    topic: "hash set",
    functionName: "containsDuplicate",
    code: `function __FN__(values) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) return true;
    seen.add(value);
  }
  return false;
}`,
  },
  {
    slug: "palindrome",
    title: "Check a palindrome",
    topic: "two pointers",
    functionName: "isPalindrome",
    code: `function __FN__(text) {
  let left = 0;
  let right = text.length - 1;
  while (left < right) {
    if (text[left++] !== text[right--]) return false;
  }
  return true;
}`,
  },
  {
    slug: "reverse-string",
    title: "Reverse a string",
    topic: "two pointers",
    functionName: "reverseText",
    code: `function __FN__(text) {
  const values = [...text];
  let left = 0;
  let right = values.length - 1;
  while (left < right) {
    [values[left], values[right]] = [values[right], values[left]];
    left++;
    right--;
  }
  return values.join("");
}`,
  },
  {
    slug: "array-sum",
    title: "Sum an array",
    topic: "array scan",
    functionName: "arraySum",
    code: `function __FN__(values) {
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total;
}`,
  },
  {
    slug: "maximum",
    title: "Find the maximum",
    topic: "array scan",
    functionName: "findMaximum",
    code: `function __FN__(values) {
  let best = values[0];
  for (const value of values) {
    best = Math.max(best, value);
  }
  return best;
}`,
  },
  {
    slug: "count-vowels",
    title: "Count vowels",
    topic: "string scan",
    functionName: "countVowels",
    code: `function __FN__(text) {
  let count = 0;
  for (const value of text) {
    if ("aeiou".includes(value.toLowerCase())) count++;
  }
  return count;
}`,
  },
  {
    slug: "binary-search",
    title: "Binary search",
    topic: "search",
    functionName: "binarySearch",
    code: `function __FN__(values, target) {
  let left = 0;
  let right = values.length - 1;
  while (left <= right) {
    const middle = left + Math.floor((right - left) / 2);
    if (values[middle] === target) return middle;
    if (values[middle] < target) left = middle + 1;
    else right = middle - 1;
  }
  return -1;
}`,
  },
  {
    slug: "two-sum",
    title: "Find a pair with a target sum",
    topic: "hash map",
    functionName: "pairForSum",
    code: `function __FN__(values, target) {
  const seen = new Map();
  for (let index = 0; index < values.length; index++) {
    const needed = target - values[index];
    if (seen.has(needed)) return [seen.get(needed), index];
    seen.set(values[index], index);
  }
  return [];
}`,
  },
  {
    slug: "valid-brackets",
    title: "Validate brackets",
    topic: "stack",
    functionName: "validBrackets",
    code: `function __FN__(text) {
  const opened = [];
  const pairs = {")": "(", "]": "[", "}": "{"};
  for (const value of text) {
    if (!(value in pairs)) opened.push(value);
    else if (opened.pop() !== pairs[value]) return false;
  }
  return opened.length === 0;
}`,
  },
  {
    slug: "merge-sorted",
    title: "Merge sorted arrays",
    topic: "two pointers",
    functionName: "mergeSorted",
    code: `function __FN__(left, right) {
  const merged = [];
  let first = 0;
  let second = 0;
  while (first < left.length && second < right.length) {
    if (left[first] <= right[second]) merged.push(left[first++]);
    else merged.push(right[second++]);
  }
  return merged.concat(left.slice(first), right.slice(second));
}`,
  },
  {
    slug: "move-zeroes",
    title: "Move zeroes to the end",
    topic: "two pointers",
    functionName: "moveZeroes",
    code: `function __FN__(values) {
  let write = 0;
  for (const value of values) {
    if (value !== 0) values[write++] = value;
  }
  while (write < values.length) {
    values[write++] = 0;
  }
}`,
  },
  {
    slug: "missing-number",
    title: "Find the missing number",
    topic: "exclusive or",
    functionName: "missingNumber",
    code: `function __FN__(values) {
  let missing = values.length;
  for (let index = 0; index < values.length; index++) {
    missing ^= index ^ values[index];
  }
  return missing;
}`,
  },
  {
    slug: "anagram",
    title: "Check an anagram",
    topic: "frequency count",
    functionName: "isAnagram",
    code: `function __FN__(first, second) {
  if (first.length !== second.length) return false;
  const counts = new Map();
  for (const value of first) counts.set(value, (counts.get(value) ?? 0) + 1);
  for (const value of second) counts.set(value, (counts.get(value) ?? 0) - 1);
  return [...counts.values()].every((count) => count === 0);
}`,
  },
  {
    slug: "first-unique",
    title: "Find the first unique character",
    topic: "frequency count",
    functionName: "firstUnique",
    code: `function __FN__(text) {
  const counts = new Map();
  for (const value of text) counts.set(value, (counts.get(value) ?? 0) + 1);
  for (let index = 0; index < text.length; index++) {
    if (counts.get(text[index]) === 1) return index;
  }
  return -1;
}`,
  },
  {
    slug: "gcd",
    title: "Greatest common divisor",
    topic: "number theory",
    functionName: "greatestDivisor",
    code: `function __FN__(first, second) {
  while (second !== 0) {
    [first, second] = [second, first % second];
  }
  return Math.abs(first);
}`,
  },
  {
    slug: "climb-stairs",
    title: "Count stair-climbing paths",
    topic: "dynamic programming",
    functionName: "climbStairs",
    code: `function __FN__(steps) {
  let previous = 0;
  let current = 1;
  for (let step = 0; step < steps; step++) {
    [previous, current] = [current, previous + current];
  }
  return current;
}`,
  },
] as const;

const TYPESCRIPT_PARAMETERS: Readonly<Record<string, string>> = {
  "contains-duplicate": "(values: number[])",
  palindrome: "(text: string)",
  "reverse-string": "(text: string)",
  "array-sum": "(values: number[])",
  maximum: "(values: number[])",
  "count-vowels": "(text: string)",
  "binary-search": "(values: number[], target: number)",
  "two-sum": "(values: number[], target: number)",
  "valid-brackets": "(text: string)",
  "merge-sorted": "(left: number[], right: number[])",
  "move-zeroes": "(values: number[])",
  "missing-number": "(values: number[])",
  anagram: "(first: string, second: string)",
  "first-unique": "(text: string)",
  gcd: "(first: number, second: number)",
  "climb-stairs": "(steps: number)",
};

const TYPESCRIPT_TEMPLATES: readonly CodeTemplate[] =
  JAVASCRIPT_TEMPLATES.map((template) => ({
    ...template,
    code: template.code
      .replace(/\([^)]*\)/u, TYPESCRIPT_PARAMETERS[template.slug] ?? "()")
      .replace("const seen = new Set();", "const seen = new Set<number>();")
      .replace("const seen = new Map();", "const seen = new Map<number, number>();")
      .replace("const opened = [];", "const opened: string[] = [];")
      .replace(
        'const pairs = {")": "(", "]": "[", "}": "{"};',
        'const pairs: Record<string, string> = {")": "(", "]": "[", "}": "{"};',
      )
      .replace("const merged = [];", "const merged: number[] = [];")
      .replace("const counts = new Map();", "const counts = new Map<string, number>();"),
  }));

const GO_TEMPLATES: readonly CodeTemplate[] = [
  {
    slug: "contains-duplicate",
    title: "Detect a repeated value",
    topic: "hash set",
    functionName: "containsDuplicate",
    code: `func __FN__(values []int) bool {
  seen := map[int]bool{}
  for _, value := range values {
    if seen[value] {
      return true
    }
    seen[value] = true
  }
  return false
}`,
  },
  {
    slug: "palindrome",
    title: "Check a palindrome",
    topic: "two pointers",
    functionName: "isPalindrome",
    code: `func __FN__(text string) bool {
  left := 0
  right := len(text) - 1
  for left < right {
    if text[left] != text[right] {
      return false
    }
    left++
    right--
  }
  return true
}`,
  },
  {
    slug: "reverse-string",
    title: "Reverse a string",
    topic: "two pointers",
    functionName: "reverseText",
    code: `func __FN__(text string) string {
  values := []rune(text)
  left := 0
  right := len(values) - 1
  for left < right {
    values[left], values[right] = values[right], values[left]
    left++
    right--
  }
  return string(values)
}`,
  },
  {
    slug: "array-sum",
    title: "Sum an array",
    topic: "array scan",
    functionName: "arraySum",
    code: `func __FN__(values []int) int {
  total := 0
  for _, value := range values {
    total += value
  }
  return total
}`,
  },
  {
    slug: "maximum",
    title: "Find the maximum",
    topic: "array scan",
    functionName: "findMaximum",
    code: `func __FN__(values []int) int {
  best := values[0]
  for _, value := range values {
    if value > best {
      best = value
    }
  }
  return best
}`,
  },
  {
    slug: "count-vowels",
    title: "Count vowels",
    topic: "string scan",
    functionName: "countVowels",
    code: `func __FN__(text string) int {
  count := 0
  for _, value := range text {
    if strings.ContainsRune("aeiouAEIOU", value) {
      count++
    }
  }
  return count
}`,
  },
  {
    slug: "binary-search",
    title: "Binary search",
    topic: "search",
    functionName: "binarySearch",
    code: `func __FN__(values []int, target int) int {
  left := 0
  right := len(values) - 1
  for left <= right {
    middle := left + (right-left)/2
    if values[middle] == target {
      return middle
    }
    if values[middle] < target {
      left = middle + 1
    } else {
      right = middle - 1
    }
  }
  return -1
}`,
  },
  {
    slug: "two-sum",
    title: "Find a pair with a target sum",
    topic: "hash map",
    functionName: "pairForSum",
    code: `func __FN__(values []int, target int) []int {
  seen := map[int]int{}
  for index, value := range values {
    needed := target - value
    if match, ok := seen[needed]; ok {
      return []int{match, index}
    }
    seen[value] = index
  }
  return []int{}
}`,
  },
  {
    slug: "valid-brackets",
    title: "Validate brackets",
    topic: "stack",
    functionName: "validBrackets",
    code: `func __FN__(text string) bool {
  opened := []rune{}
  pairs := map[rune]rune{')': '(', ']': '[', '}': '{'}
  for _, value := range text {
    expected, closing := pairs[value]
    if !closing {
      opened = append(opened, value)
    } else if len(opened) == 0 || opened[len(opened)-1] != expected {
      return false
    } else {
      opened = opened[:len(opened)-1]
    }
  }
  return len(opened) == 0
}`,
  },
  {
    slug: "merge-sorted",
    title: "Merge sorted arrays",
    topic: "two pointers",
    functionName: "mergeSorted",
    code: `func __FN__(left []int, right []int) []int {
  merged := []int{}
  first := 0
  second := 0
  for first < len(left) && second < len(right) {
    if left[first] <= right[second] {
      merged = append(merged, left[first])
      first++
    } else {
      merged = append(merged, right[second])
      second++
    }
  }
  merged = append(merged, left[first:]...)
  return append(merged, right[second:]...)
}`,
  },
  {
    slug: "move-zeroes",
    title: "Move zeroes to the end",
    topic: "two pointers",
    functionName: "moveZeroes",
    code: `func __FN__(values []int) {
  write := 0
  for _, value := range values {
    if value != 0 {
      values[write] = value
      write++
    }
  }
  for write < len(values) {
    values[write] = 0
    write++
  }
}`,
  },
  {
    slug: "missing-number",
    title: "Find the missing number",
    topic: "exclusive or",
    functionName: "missingNumber",
    code: `func __FN__(values []int) int {
  missing := len(values)
  for index, value := range values {
    missing ^= index ^ value
  }
  return missing
}`,
  },
  {
    slug: "anagram",
    title: "Check an anagram",
    topic: "frequency count",
    functionName: "isAnagram",
    code: `func __FN__(first string, second string) bool {
  if len(first) != len(second) {
    return false
  }
  counts := [26]int{}
  for index := range first {
    counts[first[index]-'a']++
    counts[second[index]-'a']--
  }
  for _, count := range counts {
    if count != 0 {
      return false
    }
  }
  return true
}`,
  },
  {
    slug: "first-unique",
    title: "Find the first unique character",
    topic: "frequency count",
    functionName: "firstUnique",
    code: `func __FN__(text string) int {
  counts := [26]int{}
  for _, value := range text {
    counts[value-'a']++
  }
  for index, value := range text {
    if counts[value-'a'] == 1 {
      return index
    }
  }
  return -1
}`,
  },
  {
    slug: "gcd",
    title: "Greatest common divisor",
    topic: "number theory",
    functionName: "greatestDivisor",
    code: `func __FN__(first int, second int) int {
  for second != 0 {
    first, second = second, first%second
  }
  if first < 0 {
    return -first
  }
  return first
}`,
  },
  {
    slug: "climb-stairs",
    title: "Count stair-climbing paths",
    topic: "dynamic programming",
    functionName: "climbStairs",
    code: `func __FN__(steps int) int {
  previous := 0
  current := 1
  for step := 0; step < steps; step++ {
    previous, current = current, previous+current
  }
  return current
}`,
  },
] as const;

const TEMPLATES: Readonly<Record<CodeLanguage, readonly CodeTemplate[]>> = {
  cpp: CPP_TEMPLATES,
  java: JAVA_TEMPLATES,
  python3: PYTHON_TEMPLATES,
  c: C_TEMPLATES,
  csharp: CSHARP_TEMPLATES,
  javascript: JAVASCRIPT_TEMPLATES,
  typescript: TYPESCRIPT_TEMPLATES,
  go: GO_TEMPLATES,
};

const VARIATION_SUFFIXES = ["", "Practice", "Scan", "Review"] as const;
export const CODE_PATTERN_COUNT = CPP_TEMPLATES.length;

const LESSONS: Readonly<
  Record<
    string,
    { lesson: string; assumptions: string; complexity: string }
  >
> = {
  "contains-duplicate": {
    lesson: "Remember each value once; a repeat is then a constant-time lookup.",
    assumptions: "hash-table operations are expected constant time",
    complexity: "O(n) expected time · O(n) space",
  },
  palindrome: {
    lesson: "Compare mirrored characters while the two pointers move inward.",
    assumptions: "comparison is exact; case and punctuation are significant",
    complexity: "O(n) time · O(1) space",
  },
  "reverse-string": {
    lesson: "Swap the outer text elements, then shrink the unresolved range.",
    assumptions: "indexing follows the selected language's native string model",
    complexity: "O(n) time · O(n) copied text",
  },
  "array-sum": {
    lesson: "Carry one running total through a single left-to-right scan.",
    assumptions: "the sum fits the declared return type",
    complexity: "O(n) time · O(1) space",
  },
  maximum: {
    lesson: "The best value seen so far is the loop invariant.",
    assumptions: "the input array is non-empty",
    complexity: "O(n) time · O(1) space",
  },
  "count-vowels": {
    lesson: "Check each character against the upper- and lowercase vowel set during one scan.",
    assumptions: "vowels are the ASCII English letters A, E, I, O, and U",
    complexity: "O(n) time · O(1) space",
  },
  "binary-search": {
    lesson: "Discard half of the sorted search range after every comparison.",
    assumptions: "values are sorted in nondecreasing order",
    complexity: "O(log n) time · O(1) space",
  },
  "two-sum": {
    lesson: "Store earlier values so each complement can be found immediately.",
    assumptions: "hash lookups are expected constant time and integer sums fit",
    complexity: "O(n) expected time · O(n) space",
  },
  "valid-brackets": {
    lesson: "A stack keeps the most recent unmatched opening bracket available.",
    assumptions: "input contains only parentheses, brackets, and braces",
    complexity: "O(n) time · O(n) space",
  },
  "merge-sorted": {
    lesson: "Advance the pointer whose current value is smaller.",
    assumptions: "both inputs are sorted in nondecreasing order",
    complexity: "O(n + m) time · O(n + m) space",
  },
  "move-zeroes": {
    lesson: "A write pointer compacts nonzero values before the remaining fill.",
    assumptions: "the input array is mutable",
    complexity: "O(n) time · O(1) space",
  },
  "missing-number": {
    lesson: "Equal values cancel under XOR, leaving the absent index.",
    assumptions: "values are distinct integers drawn from zero through n",
    complexity: "O(n) time · O(1) space",
  },
  anagram: {
    lesson: "Balanced frequencies prove both strings contain the same multiset.",
    assumptions: "both strings contain lowercase English letters",
    complexity: "O(n) time · O(k) space",
  },
  "first-unique": {
    lesson: "Count first, then scan again to preserve the original order.",
    assumptions: "the string contains lowercase English letters",
    complexity: "O(n) time · O(k) space",
  },
  gcd: {
    lesson: "Replace the pair with divisor and remainder until the remainder is zero.",
    assumptions: "the absolute result is representable by the integer type",
    complexity: "O(log min(|a|, |b|)) time · O(1) space",
  },
  "climb-stairs": {
    lesson: "Only the previous two path counts are needed for the next state.",
    assumptions: "steps are nonnegative and the result fits the integer type",
    complexity: "O(n) time · O(1) space",
  },
};

function variantFunctionName(
  language: CodeLanguage,
  baseName: string,
  variation: number,
): string {
  const suffix = VARIATION_SUFFIXES[variation] ?? "";
  if (suffix.length === 0) return baseName;
  if (language === "python3" || language === "c") {
    return `${baseName}_${suffix.toLowerCase()}`;
  }
  return `${baseName}${suffix}`;
}

function normalizeCode(value: string): string {
  return value
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => {
      const trimmed = line.replace(/\s+$/u, "");
      const compactIndentation = trimmed.match(/^ +/u)?.[0].length ?? 0;
      if (compactIndentation % 2 !== 0) {
        throw new Error(
          `Code corpus indentation must align to the two-space authoring grid: ${line}`,
        );
      }
      const indentationLevel = compactIndentation / 2;
      return `${" ".repeat(indentationLevel * EMITTED_CODE_INDENT_WIDTH)}${trimmed.slice(compactIndentation)}`;
    })
    .join("\n")
    .trim();
}

export function exercisesForLanguage(
  language: CodeLanguage,
): readonly CodeExercise[] {
  return TEMPLATES[language].flatMap((template) =>
    VARIATION_SUFFIXES.map((_, variation) => {
      const learning = LESSONS[template.slug];
      if (learning === undefined) {
        throw new Error(`Missing learning note for ${template.slug}.`);
      }
      return {
        id: `code-v2-${language}-${template.slug}-${String(variation + 1)}`,
        language,
        title: template.title,
        topic: template.topic,
        lesson: template.lesson ?? learning.lesson,
        assumptions: template.assumptions ?? learning.assumptions,
        complexity: template.complexity ?? learning.complexity,
        variation: variation + 1,
        code: normalizeCode(
          template.code.replaceAll(
            "__FN__",
            variantFunctionName(language, template.functionName, variation),
          ),
        ),
      };
    }),
  );
}

export const CODE_EXERCISE_COUNT = CODE_LANGUAGES.reduce(
  (total, language) => total + exercisesForLanguage(language.id).length,
  0,
);

export function selectCodeExercise(
  language: CodeLanguage,
  seed: number,
): CodeExercise {
  const exercises = exercisesForLanguage(language);
  const selected = exercises[(seed >>> 0) % exercises.length];
  if (selected === undefined) {
    throw new Error(`The ${language} code corpus is empty.`);
  }
  return selected;
}

export function codeLanguageLabel(language: CodeLanguage): string {
  return (
    CODE_LANGUAGES.find((candidate) => candidate.id === language)?.label ??
    language
  );
}
