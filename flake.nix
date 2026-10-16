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
            export CHROMIUM_BIN="$(command -v chromium)"
            echo ""
            echo "  Station Météo dev shell"
            echo "  ----------------------"
            echo "  serve        — start local dev server (python http.server on :8000)"
            echo "  shot <name>  — take a headless screenshot into screenshots/"
            echo "  test         — run browser tests with puppeteer-core"
            echo "  icons        — regenerate PWA icons from SVG source"
            echo ""
          '';

          CHROMIUM_BIN = "${pkgs.chromium}/bin/chromium";
        };

        # Convenience: serve the app
        apps.serve = {
          type = "app";
          program = "${pkgs.python3}/bin/python3 -m http.server 8000";
        };
      });
}
