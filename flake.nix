{
  description = "Station Météo — Weather station PWA for idle-tablet display";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            # Dev server
            python3
            # Browser for testing / screenshots (headless)
            chromium
            # Node.js for puppeteer-core browser tests
            nodejs_22
            # Icon generation (SVG → PNG for PWA)
            imagemagick
            librsvg
            # API testing / debugging
            curl
            jq
          ];

          shellHook = ''
            export CHROMIUM_BIN="${pkgs.chromium}/bin/chromium"
            echo ""
            echo "  Station Météo dev shell"
            echo "  ----------------------"
            echo "  Tools on PATH: python3, chromium, node, magick, curl, jq."
            echo ""
            echo "  Helper commands are flake apps — run them with nix run:"
            echo "    nix run .#serve          — dev server (python http.server on :8080)"
            echo "    nix run .#shot -- <name> — headless screenshot into screenshots/ (starts a temp server)"
            echo "    nix run .#test           — puppeteer-core browser tests"
            echo "    nix run .#icons          — regenerate PWA icons from SVG source"
            echo ""
          '';

          CHROMIUM_BIN = "${pkgs.chromium}/bin/chromium";
        };

        # Helper commands — invoke with: nix run .#<name> [-- args]
        apps = {
          serve = {
            type = "app";
            program = "${pkgs.writeShellScriptBin "serve" ''
              exec ${pkgs.python3}/bin/python3 -m http.server 8080
            ''}/bin/serve";
          };

          shot = {
            type = "app";
            program = "${pkgs.writeShellScriptBin "shot" ''
              set -eu
              name="''${1:-desktop}"
              mkdir -p screenshots
              ${pkgs.python3}/bin/python3 -m http.server 8080 >/dev/null 2>&1 &
              server_pid=$!
              trap 'kill $server_pid 2>/dev/null' EXIT
              sleep 1
              ${pkgs.chromium}/bin/chromium --headless=new --no-sandbox \
                --screenshot="screenshots/$name.png" \
                --window-size=1920,1080 \
                http://localhost:8080
            ''}/bin/shot";
          };

          test = {
            type = "app";
            program = "${pkgs.writeShellScriptBin "test" ''
              set -eu
              if [ ! -d node_modules/puppeteer-core ]; then
                echo "node_modules/puppeteer-core not found — run 'npm install' first." >&2
                exit 1
              fi
              export CHROMIUM_BIN="${pkgs.chromium}/bin/chromium"
              ${pkgs.python3}/bin/python3 -m http.server 8080 >/dev/null 2>&1 &
              server_pid=$!
              trap 'kill $server_pid 2>/dev/null' EXIT
              sleep 1
              ${pkgs.nodejs_22}/bin/node tests/browser-test.mjs "$@"
            ''}/bin/test";
          };

          icons = {
            type = "app";
            program = "${pkgs.writeShellScriptBin "icons" ''
              set -eu
              ${pkgs.imagemagick}/bin/magick -background none assets/icons-src/icon.svg -resize 192x192 assets/icons/192.png
              ${pkgs.imagemagick}/bin/magick -background none assets/icons-src/icon.svg -resize 512x512 assets/icons/512.png
              ${pkgs.imagemagick}/bin/magick -background none assets/icons-src/icon.svg -resize 180x180 assets/icons/apple-touch.png
              ${pkgs.imagemagick}/bin/magick -background none assets/icons-src/icon.svg -resize 32x32 assets/icons/favicon.png
            ''}/bin/icons";
          };
        };
      });
}
