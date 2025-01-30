#!/bin/bash

# Extracts code blocks from README.md and checks them with TypeScript compiler

awk '/^```/{
    if (p) {
        p=0;
        close(file)
    } else {
        p=1;
        count++;
        lang=$0;
        sub(/^```/, "", lang);
        if (lang == "") lang="txt";
        file=sprintf("readme_example_%d.%s", count, lang)
        next
    }
}
p{print > file}' README.md

echo "Checking typescript examples"
npx tsc --noEmit --module node16 readme_example_*.ts

rm readme_example_*