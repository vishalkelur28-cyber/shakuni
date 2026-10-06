//! Shakuni autonomous property harness — runs against the REAL WAL.
//!
//! Lead (malachite): "Crash-recovery (WAL) replays into an inconsistent step."
//! Area flagged by PR #1594 ("tolerate trailing corrupted WAL entries during replay").
//!
//! Method: for randomized sequences of random-byte entries, append them to a
//! real `Log` across one or more restarts (close + reopen, simulating a crash
//! and recovery), then replay by reopening and iterating. Assert the replayed
//! entries equal exactly what was written — same count, same bytes, same order.
//!
//! A run where replay drops, reorders, corrupts, duplicates, or invents an
//! entry is a real WAL durability/replay bug. HELD = "could not break it"
//! (honest outcome); BROKEN = reproducible seed.

use std::io;

use arc_malachitebft_wal::Log;
use tempfile::tempdir;

struct Rng(u64);
impl Rng {
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E3779B97F4A7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
        z ^ (z >> 31)
    }
    fn below(&mut self, n: u64) -> u64 { self.next() % n }
}

struct Counterexample {
    seed: u64,
    detail: String,
}

fn run_one(seed: u64, dir: &std::path::Path, i: u64) -> Result<u64, Counterexample> {
    let mut rng = Rng(seed);
    let path = dir.join(format!("wal_{i}.log"));

    // Build the ground-truth entries: random count of random-byte blobs.
    let count = 1 + rng.below(16) as usize; // 1..=16 entries (widened)
    let mut written: Vec<Vec<u8>> = Vec::with_capacity(count);
    for _ in 0..count {
        let len = rng.below(256) as usize; // 0..=255 bytes (widened)
        let mut e = Vec::with_capacity(len);
        for _ in 0..len {
            e.push((rng.below(256)) as u8);
        }
        written.push(e);
    }

    // Append across 1..=3 restarts: close and reopen between batches (crash + recovery).
    let restarts = 1 + rng.below(4) as usize; // up to 4 crash/recovery cycles (widened)
    let mut idx = 0usize;
    for r in 0..restarts {
        let remaining_batches = restarts - r;
        let take = if r == restarts - 1 { written.len() - idx } else { (written.len() - idx) / remaining_batches };
        let result: io::Result<()> = (|| {
            let mut wal = Log::open(&path)?;
            for e in &written[idx..idx + take] {
                wal.append(e)?;
            }
            wal.flush()?;
            Ok(())
        })();
        if let Err(e) = result {
            return Err(Counterexample { seed, detail: format!("append/flush I/O error at batch {r}: {e}") });
        }
        idx += take;
    }

    // Replay: reopen and read everything back.
    let replayed: io::Result<Vec<Vec<u8>>> = (|| {
        let mut wal = Log::open(&path)?;
        let mut out = Vec::new();
        for entry in wal.iter()? {
            out.push(entry?);
        }
        Ok(out)
    })();
    let replayed = match replayed {
        Ok(v) => v,
        Err(e) => return Err(Counterexample { seed, detail: format!("replay (reopen+iter) errored on a cleanly-written log: {e}") }),
    };

    // Clean up this iteration's file to bound disk use.
    let _ = std::fs::remove_file(&path);

    if replayed.len() != written.len() {
        return Err(Counterexample { seed, detail: format!("count mismatch: wrote {} entries, replay returned {}", written.len(), replayed.len()) });
    }
    for (k, (w, r)) in written.iter().zip(replayed.iter()).enumerate() {
        if w != r {
            return Err(Counterexample { seed, detail: format!("entry {k} differs: wrote {} bytes, replayed {} bytes", w.len(), r.len()) });
        }
    }
    Ok(written.len() as u64)
}

#[test]
fn shakuni_wal_roundtrip_is_exact() {
    let iters: u64 = std::env::var("SHAKUNI_ITERS").ok().and_then(|s| s.parse().ok()).unwrap_or(20_000);
    let base: u64 = std::env::var("SHAKUNI_SEED").ok().and_then(|s| s.parse().ok()).unwrap_or(0x1A7E5);

    let dir = tempdir().expect("make temp dir");
    let mut total_entries: u64 = 0;
    for i in 0..iters {
        let seed = base ^ i.wrapping_mul(0x100000001B3);
        match run_one(seed, dir.path(), i) {
            Ok(e) => total_entries += e,
            Err(ce) => panic!("WAL REPLAY MISMATCH: {} seed={}", ce.detail, ce.seed),
        }
    }

    println!("SHAKUNI_PROPERTY name=wal_roundtrip_exact iters={} quorums_verified={} violations=0 result=HELD", iters, total_entries);
    assert!(total_entries > 0, "harness never round-tripped an entry — property is vacuous");
}
