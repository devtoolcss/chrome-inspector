[![Chrome Web Store Version](https://img.shields.io/chrome-web-store/v/jgiapjeogionjfbonpiamipcedcnohha)](https://chromewebstore.google.com/detail/chrome-inspector-sync/jgiapjeogionjfbonpiamipcedcnohha)

By CDP's design, DevTool is a separated client like the one wrapped by `Inspector`, and each client maintains its own [Command Line API](https://chromedevtools.github.io/devtools-protocol/tot/Runtime/#method-evaluate) like $0, so we must inject some code in browser's DevTool to get it. That's why this extension is needed.

## TODO

Can be replaced by eval in devtool page? not sure compatibility and limitation.
https://github.com/ChromeDevTools/chrome-devtools-mcp/commit/796aed72b7126ed4332888ffbc06d6cb678265ef
