// handle script arguments with yargs
const argv = require("yargs")
    .demandOption(["site"])
    .default("port", 80)
    .alias("s", "site")
    .alias("p", "port")
    .alias("i", "ip")
    .describe("site", "The name of the site to serve")
    .describe("port", "The port on which to serve the site")
    .describe("ip", "Optionally bind the site to an IP").argv;
// okay, things look good for now; let's pull in fs
const fs = require("fs");
// assign the script arguments to site and port constants
const site = argv.site;
const port = parseInt(argv.port);
// pull in our templates and try to assign a default template for our views
let defaultTemplate;
JSON.parse(fs.readFileSync(__dirname + "/templates.json")).some(function(templateDef) {
    if (templateDef.sites.includes(site)) {
        defaultTemplate = templateDef.name;
        return true;
    }
});
// if the template couldn't be assigned, the site was misspelled or needs to be added to templates.json
if (!defaultTemplate) {
    console.log("Site provided is not configured in templates.json");
    return;
}
// okay cool, a valid site and port have been provided, let's pull in express and create our server and router instances
const express = require("express");
const app = express();
const router = express.Router();
// set the view engine to use pug
app.set("view engine", "pug");
// explicitly set the base directory (fixes a path issue in the pug files)
app.locals.basedir = __dirname;
// quick utility for later use
function isRequestComingFromGiftTree(req) {
    // TODO: check for a list of IPs
    return true;
}
// pull in the applicable routes for this site and loop through them
let routes = {};
function loadRoutes() {
    ["common", "tmpl-" + defaultTemplate, "site-" + site].forEach(function(routeFile) {
        let routeFilepath = `${__dirname}/routes/${routeFile}.json`;
        if (fs.existsSync(routeFilepath)) {
            JSON.parse(fs.readFileSync(routeFilepath)).forEach(function(route) {
                /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
                 * Important Note On Performance:                                            *
                 * Anything inside router.get() is executed upon EACH REQUEST.               *
                 * Because of this, try to keep as much as possible outside of router.get()  *
                 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
                // respect the site blacklist if present
                if (route.siteBlacklist && route.siteBlacklist.includes(site)) {
                    return;
                }
                // if this is happening due to /reload-routes, check for pre-existing routes
                if (routes[route.route.toString()]) {
                    if (route.special || JSON.stringify(routes[route.route.toString()]) === JSON.stringify(route)) {
                        // if this is a special route or the route hadn't changed from last load, do nothing
                        return;
                    }
                    // replace the existing route in the route cache and stop here since the router.get() was already set up
                    routes[route.route.toString()] = route;
                    return;
                }
                // add this route to our route cache
                routes[route.route.toString()] = route;
                if (route.special) {
                    // if a "special" key was provided, deal with it here
                    switch (route.special) {
                        case "favicon":
                            // TODO
                            break;
                        case "manifest":
                            router.get(route.route, (req, res) =>
                                res.sendFile(__dirname + "/public/manifests/" + site + ".json")
                            );
                            break;
                        case "reloadRoutes":
                            router.get(route.route, function(req, res) {
                                if (isRequestComingFromGiftTree(req)) {
                                    loadRoutes();
                                    res.send("Routes reloaded successfully.");
                                } else {
                                    res.status(404).send("This route is only available internally.");
                                }
                            });
                            break;
                        case "robots":
                            // TODO
                            break;
                        case "serviceworker":
                            router.get(route.route, function(req, res) {
                                let filepath = __dirname + "/public/js/serviceworkers/" + site + ".js";
                                if (fs.existsSync(filepath)) {
                                    res.sendFile(filepath);
                                } else {
                                    res.status(404).send("No service worker available for this site.");
                                }
                            });
                            break;
                        case "sitemap":
                            // TODO
                            break;
                        case "swagger-editor":
                            router.get(route.route, (req, res) =>
                                res.sendFile(__dirname + "/node_modules/swagger-editor-dist/index.html")
                            );
                            break;
                    }
                } else if (!["common", "template", "site"].includes(route.scope)) {
                    // if the scope provided for this route is invalid, catch it now so the dev can correct it
                    throw new Error(
                        "Error in Route Object (" +
                            route.route +
                            '): Property "scope" should be one of "common", "template", or "site".'
                    );
                } else {
                    // load the route into the Express app
                    router.get(route.route, function(req, res) {
                        // load the cached version of the route so we can change properties during runtime if we need to
                        let dynamicRoute = routes[route.route.toString()];
                        // respect the template override for the route if there is one
                        let template = dynamicRoute.templateOverride ? dynamicRoute.templateOverride : defaultTemplate;
                        // serve the pug file with some passdown data upon request
                        res.render(
                            "pages/" +
                                (dynamicRoute.scope === "common"
                                    ? "common"
                                    : dynamicRoute.scope === "template"
                                    ? "_template-" + template
                                    : "_site-" + site) +
                                "/" +
                                dynamicRoute.view,
                            {
                                customParams: dynamicRoute.data ? dynamicRoute.data : {},
                                queryParams: req.query,
                                routeParams: req.params,
                                site: site,
                                template: template
                            }
                        );
                    });
                }
            });
            console.log("\x1b[32m%s\x1b[0m", "/routes/" + routeFile + ".json successfully loaded.");
        } else {
            console.log("\x1b[33m%s\x1b[0m", "/routes/" + routeFile + ".json not loaded (file does not exist).");
        }
    });
}
loadRoutes();
// if we made it here, no issues were found with the applicable routes
app.use("/", router);
// serve /public at site root (i.e. /public/file.ext serves at domain.com/file.ext)
app.use(express.static("public"));
// some special sauce only for gs4
if (site === "gs4") {
    // serve the Swagger Editor folder so index.html can access the files from where it thinks they are (keeping it in node_modules ensures we can update easily)
    app.use("/it", express.static("node_modules/swagger-editor-dist"));
}
// **ALWAYS HAVE AS LAST APP.USE** 404 Handler
app.use((req, res) => res.status(404).render(__dirname + "/views/pages/common/404"));
// start listening on the dev-provided port
if (argv.ip) {
    // if the dev provided an ip, also bind to that
    app.listen(port, argv.ip, () => console.log(`Now serving site "${site}" on IP ${argv.ip} and port ${port}`));
} else {
    app.listen(port, () => console.log(`Now serving site "${site}" at http://localhost:${port}/`));
}
