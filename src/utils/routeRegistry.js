// Holds the mounted API routers so the system report can inspect them without
// importing the route modules (which would create an import cycle).
let mounted = [];

export const registerMountedRouters = (basePath, endpoints) => {
    mounted = endpoints.map(({ path, router }) => ({ path: `${basePath}${path}`, router }));
};

export const getMountedRouters = () => mounted;
