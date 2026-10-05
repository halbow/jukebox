# List the recipes
default:
    @just --list

# Run the tests (Node 22.15+, nothing to install)
test:
    node --test

# Serve the app locally
serve:
    npx serve .
