# Simple Server Multisite

Requires [NodeJS](https://nodejs.org/en/) v12.14.0 or above.

First time? This will **install server dependencies**:

    npm install

Want to **start serving a site at localhost**?

    node app.js (site) (port)

### Working on scripts?

This will **transpile your TypeScript on save**:

    npm run ts-watch

Made script changes without the watcher running? This will do a **one-time transpile of all TypeScript**:

    npm run ts-build

### Working on styles?

This will **transpile your SCSS on save**:

    npm run scss-watch

Made style changes without the watcher running? This will do a **one-time transpile of all SCSS**:

    npm run scss-build

### Need to reload routes without restarting app.js?

    curl "(site instance address)/reload-routes"

> Only new or changed non-special routes can be refreshed in this way. For deleting routes or changing special routes, you will need to restart `app.js`

### Ready for production?

It's always nice to make sure a consistent code style is followed for TS and SCSS. Run `prettier` as configured:

    npm run prettier

This will **start fresh JS & CSS directories, then transpile and minify all TS & SCSS**:

    npm run freshmin

# Technical Goals & Notes

### Separation of Concerns

-   A primary goal of this client server is to employ as little logic as possible on the server-side.
-   The client server should be unaware of and should never connect directly to other company services.
-   Code _contained_ in files served to the browser _can and should_ connect to other company services (i.e. our API).

### Where does this client server fit in a server ecosystem?

-   It is intended that we spin up a production server for each site and that it controls the "www" and subdomainless addresses.
-   When we're ready to install SSL certificates, they can be handled with a few extra lines in `app.js`.
-   This was developed with the assumption that an API will live on a different domain or a subdomain (e.g. api.domain.com)

### Routing in Express

-   See the [Express Docs on Routing](https://expressjs.com/en/guide/routing.html).
-   GET Requests Only: There should be no reason a POST or other method should need to be made to the client server.
-   Requests may include query params, but nothing server-side should happen with the data that's not templating-related.
-   In most cases, query params and hash data are just passed _through_ the client server to be available for code running in the browser.
-   If the route uses wildcards or regular expression, route params will also be passed down to the Pug files.
-   All route files are kept in `/routes/` (go figure) and are broken down by...
    -   `common`: For routes that are shared across all sites.
    -   `template`: For routes shared across sites with the same template.
    -   `site`: For site-specific routes.

### Markup in Pug

-   This client server uses Pug as the markup templating language, which has a [different syntax than HTML](https://pugjs.org/api/getting-started.html).
-   Pug allows us to do some dynamic templating without overcomplicating our custom code.
-   Pug automatically caches templates when the server is in production mode.
-   There are two main wrapper files: `master.pug` and `master.amp.pug`
    -   These master files are extended by the page files, and pull in the appropriate layout mixin file.
-   Besides the master and layout files, all Pug files are kept in `/views/pages` and are broken down by...
    -   `common`: For pages that are shared across all sites.
    -   `template`: For pages shared across sites with the same template.
    -   `site`: For site-specific pages.

### Scripts & Styles in TypeScript & Sass

-   TypeScript (TS) and SCSS are supersets of JS and CSS, so regular JS and CSS can be used within .ts and .scss files.
-   Refrain from editing files in `/public/js` and `/public/css` directly, as they will be overwritten by the NPM scripts above.

# Top-Level Directories & Files

-   `node_modules`: Where dependencies are kept; is git-ignored and populated with `npm install`; no need to touch this
-   `public`: Where files are kept that should be directly accessible over HTTP via the browser
-   `routes`: A collection of JSON files that contain all the routes
-   `scss`: All styles should go here, and are compiled with `scss-watch` or `scss-build` into `/public/css`
-   `ts`: All client-side scripts should go here, and are compiled with `ts-watch` or `ts-build` into `/public/js`
-   `views`: All markup templates should go here, and are served by the client server application
-   `app.js`: Once instantiated with a site and port, handles the routing of incoming HTTP requests and serves rendered Pug files
-   `package.json`: Defines basic project configuration data: name, dependencies, scripts, etc.
-   `package-lock.json`: Another config file required by the NPM ecosystem; no need to touch this
-   `templates.json`: Where we define all of our sites and the templates to which they belong
-   `tsconfig.json`: A config file for TypeScript; no need to touch this
-   `README.md`: This is the file you're reading right now!

# Properties of The Route Object

-   `route`:
    -   Required for all routes
    -   The request path to which to listen
    -   See `Routing in Express` in `Technical Goals & Notes` above
-   `special`:
    -   If the route should serve something other than a Pug file, provide a key here and add a switch case in `app.js`
-   `scope`:
    -   Required for all non-special routes
    -   Must be one of `common`, `template`, or `site`
    -   See `Markup in Pug` in `Technical Goals & Notes` above
-   `view`:
    -   Required for all non-special routes
    -   The filename or path and filename to the Pug page file, without the .pug extension
-   `data`:
    -   Any route-specific data you would like passed down to the Pug file in addition to route and query params
-   `siteBlacklist`:
    -   Optional array of site names
    -   If used, sites in this list cannot access this route
-   `templateOverride`:
    -   Optional template name
    -   If used, the route will be served as though the user is on a site belonging to the specified template
