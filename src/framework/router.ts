import { createMemberMetaDecorator, getMembers } from './lib/decoratorUtils'
import 'reflect-metadata'
import { DIC } from './lib/di'
import { Controller } from './controller'

const defaultPath = '/'

interface RouteInfo {
    path: string
}

function joinPath(...rest: string[]) {
    return rest
        .map((i) => `/${i}`.replace(/\/\//g, '/'))
        .join('/')
        .replace(/\/\//g, '/')
}

const routeKey = Symbol.for('route')

function getControllerMembers(controller: Controller) {
    return getMembers<keyof Controller>(controller, routeKey)
}
function getRouteInfo(
    target: object | (new (...rest: any[]) => any),
    key?: string | symbol,
) {
    let info: RouteInfo | undefined
    if (key !== undefined) {
        info = Reflect.getMetadata(routeKey, target, key)
    } else {
        info = Reflect.getMetadata(routeKey, target)
    }
    return Object.assign({}, { path: defaultPath }, info)
}

function createRouter() {
    const Route = (route: RouteInfo) =>
        createMemberMetaDecorator((target, key) => {
            if (key === undefined && target instanceof Function) {
                Reflect.metadata(routeKey, route)(target)
            } else if (key !== undefined && target[key] instanceof Function) {
                Reflect.metadata(routeKey, route)(target, key)
            }
        }, routeKey)

    Route.path = (path: string) => Route({ path })
    Route.default = () => (target: object, key: string | symbol) =>
        Route({ path: defaultPath })(target, key)

    const context = {
        async instantiateControllers(
            controllerClasses: Controller[],
            dic: DIC,
            ...rest: ConstructorParameters<Controller>
        ) {
            return Promise.all(
                controllerClasses.map(async (C) => {
                    return dic.makeWithTimeout(C, -1, ...rest)
                }),
            ).catch((err) => {
                console.warn('some Controller are not provided')
                throw err
            })
        },

        async getControllersRoutes(controllerClasses: Controller[], dic: DIC) {
            return context.mapRouteControllers(
                controllerClasses,
                dic,
                (_, c, m) => {
                    return {
                        Controller: c.constructor as new (
                            ...rest: any[]
                        ) => any,
                        method: m,
                    }
                },
            )
        },

        async mapRouteControllers<T>(
            controllerClasses: Controller[],
            dic: DIC,
            mapper: (path: string, controller: Controller, m: string) => T,
        ) {
            const routes: {
                [k: string]: T | undefined
            } = {}
            const controllers = (
                await context.instantiateControllers(controllerClasses, dic)
            ).filter((c) => !!c) as InstanceType<Controller>[]
            controllers.forEach((controller) => {
                const C = controller.constructor as Controller
                const members = getControllerMembers(C)
                if (members.length > 0) {
                    const controllerRouteInfo = getRouteInfo(C)
                    members.forEach((m) => {
                        const routeInfo = getRouteInfo(controller, m)
                        const path = joinPath(
                            ...[
                                controllerRouteInfo.path,
                                routeInfo.path,
                            ].filter((r) => !!r),
                        )
                        if (controller[m] instanceof Function) {
                            routes[path] = mapper(path, controller, m)
                        }
                    })
                }
            })
            return {
                routes,
                controllers: controllers,
            }
        },

        async routeControllers(controllerClasses: Controller[], dic: DIC) {
            const routes = context.mapRouteControllers(
                controllerClasses,
                dic,
                (_, c, m) => {
                    return (...rest: any[]) => c[m](...rest)
                },
            )
            return routes
        },
        Route,
    }
    return context
}

export const router = createRouter()
export const Route = router.Route
