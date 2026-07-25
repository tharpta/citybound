extern crate kay_codegen;

use std::env;
use std::path::Path;

fn main() {
    let crate_roots: Vec<_> = env::args().skip(1).collect();
    if crate_roots.is_empty() {
        panic!("expected at least one crate root");
    }

    for crate_root in crate_roots {
        env::set_current_dir(Path::new(&crate_root))
            .unwrap_or_else(|error| panic!("failed to enter {}: {}", crate_root, error));
        kay_codegen::scan_and_generate("src");
    }
}
