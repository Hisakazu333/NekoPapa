//! A unified diff of two texts, for the Agent's change cards. The front end
//! parses it with the same parser as the 更改 panel (parseUnifiedDiff), so it
//! only has to produce `@@` hunks with ` `, `-` and `+` lines.
//!
//! Common leading and trailing lines are trimmed first; the rest is compared
//! line by line (longest common subsequence) when it is small enough, and
//! otherwise shown as one replaced block, which is still a correct diff.

const CONTEXT: usize = 3;
/// Above this many cells the middle is shown as one replaced block.
const MAX_TABLE: usize = 1_000_000;

#[derive(Clone, Copy, PartialEq, Debug)]
enum Op {
    Same,
    Del,
    Add,
}

pub struct Diff {
    pub text: String,
    pub added: u32,
    pub removed: u32,
}

fn lines(text: &str) -> Vec<&str> {
    if text.is_empty() { Vec::new() } else { text.strip_suffix('\n').unwrap_or(text).split('\n').collect() }
}

/// Each line of `old` and `new` tagged as kept, removed or added, in order.
fn script(old: &[&str], new: &[&str]) -> Vec<(Op, usize, usize)> {
    let prefix = old.iter().zip(new).take_while(|(a, b)| a == b).count();
    let suffix = old[prefix..].iter().rev().zip(new[prefix..].iter().rev()).take_while(|(a, b)| a == b).count();
    let (a, b) = (&old[prefix..old.len() - suffix], &new[prefix..new.len() - suffix]);
    let mut ops: Vec<(Op, usize, usize)> = (0..prefix).map(|i| (Op::Same, i, i)).collect();
    if (a.len() + 1) * (b.len() + 1) <= MAX_TABLE {
        // table[i][j] = longest common subsequence of a[i..] and b[j..].
        let width = b.len() + 1;
        let mut table = vec![0u32; (a.len() + 1) * width];
        for i in (0..a.len()).rev() {
            for j in (0..b.len()).rev() {
                table[i * width + j] = if a[i] == b[j] { table[(i + 1) * width + j + 1] + 1 } else { table[(i + 1) * width + j].max(table[i * width + j + 1]) };
            }
        }
        let (mut i, mut j) = (0, 0);
        while i < a.len() || j < b.len() {
            if i < a.len() && j < b.len() && a[i] == b[j] {
                ops.push((Op::Same, prefix + i, prefix + j));
                i += 1;
                j += 1;
            } else if i < a.len() && (j == b.len() || table[(i + 1) * width + j] >= table[i * width + j + 1]) {
                // Removed lines come before the lines that replace them.
                ops.push((Op::Del, prefix + i, prefix + j));
                i += 1;
            } else {
                ops.push((Op::Add, prefix + i, prefix + j));
                j += 1;
            }
        }
    } else {
        ops.extend((0..a.len()).map(|i| (Op::Del, prefix + i, prefix)));
        ops.extend((0..b.len()).map(|j| (Op::Add, prefix + a.len(), prefix + j)));
    }
    let (old_end, new_end) = (old.len() - suffix, new.len() - suffix);
    ops.extend((0..suffix).map(|k| (Op::Same, old_end + k, new_end + k)));
    ops
}

pub fn unified(old_text: &str, new_text: &str) -> Diff {
    let (old, new) = (lines(old_text), lines(new_text));
    let ops = script(&old, &new);
    let changed: Vec<usize> = ops.iter().enumerate().filter(|(_, op)| op.0 != Op::Same).map(|(index, _)| index).collect();
    let mut diff = Diff { text: String::new(), added: 0, removed: 0 };
    let mut index = 0;
    while index < changed.len() {
        // A hunk runs from CONTEXT lines before a change to CONTEXT after the
        // last change that is no more than 2 * CONTEXT kept lines away.
        let mut last = index;
        while last + 1 < changed.len() && changed[last + 1] - changed[last] <= 2 * CONTEXT + 1 {
            last += 1;
        }
        let start = changed[index].saturating_sub(CONTEXT);
        let end = (changed[last] + CONTEXT + 1).min(ops.len());
        let hunk = &ops[start..end];
        let old_count = hunk.iter().filter(|op| op.0 != Op::Add).count();
        let new_count = hunk.iter().filter(|op| op.0 != Op::Del).count();
        let old_start = if old_count == 0 { hunk[0].1 } else { hunk[0].1 + 1 };
        let new_start = if new_count == 0 { hunk[0].2 } else { hunk[0].2 + 1 };
        diff.text.push_str(&format!("@@ -{old_start},{old_count} +{new_start},{new_count} @@\n"));
        for &(op, i, j) in hunk {
            match op {
                Op::Same => diff.text.push_str(&format!(" {}\n", old[i])),
                Op::Del => {
                    diff.removed += 1;
                    diff.text.push_str(&format!("-{}\n", old[i]));
                }
                Op::Add => {
                    diff.added += 1;
                    diff.text.push_str(&format!("+{}\n", new[j]));
                }
            }
        }
        index = last + 1;
    }
    diff
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn marks_changed_lines_with_context() {
        let diff = unified("a\nb\nc\nd\ne\nf\ng\nh\n", "a\nb\nc\nD\ne\nf\ng\nh\n");
        assert_eq!(diff.text, "@@ -1,7 +1,7 @@\n a\n b\n c\n-d\n+D\n e\n f\n g\n");
        assert_eq!((diff.added, diff.removed), (1, 1));
    }

    #[test]
    fn handles_new_and_emptied_files_and_no_change() {
        let created = unified("", "one\ntwo\n");
        assert_eq!(created.text, "@@ -0,0 +1,2 @@\n+one\n+two\n");
        let emptied = unified("one\n", "");
        assert_eq!(emptied.text, "@@ -1,1 +0,0 @@\n-one\n");
        assert_eq!(unified("same\n", "same\n").text, "");
    }

    #[test]
    fn splits_distant_changes_into_hunks() {
        let old: String = (1..=20).map(|n| format!("{n}\n")).collect();
        let new: String = (1..=20).map(|n| match n { 2 => "two\n".to_string(), 19 => "nineteen\n".to_string(), _ => format!("{n}\n") }).collect();
        let diff = unified(&old, &new);
        assert_eq!(diff.text.matches("@@ -").count(), 2);
        assert_eq!((diff.added, diff.removed), (2, 2));
    }
}
