import { Controller } from './controller'
import { createMemberMetaDecorator, getMembers } from './lib/decoratorUtils'
import 'reflect-metadata'
import { DIC } from './lib/di'

const defaultPath = '/'

interface RouteInfo {
    path: string
}

const routeKey = Symbol.for('route')

function getControllerMembers(controller: typeof Controller) {
    return getMembers<keyof typeof controller>(controller, routeKey)
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
        Route({ path: '' })(target, key)

    const context = {
        async instantiateControllers(
            controllerClasses: (typeof Controller)[],
            dic: DIC,
            ...rest: ConstructorParameters<typeof Controller>
        ) {
            return Promise.all(
                controllerClasses.map(async (C) => {
                    return dic.getWithTimeout(C, -1, ...rest)
                }),
            ).catch((err) => {
                console.warn('some Controller are not provided')
                throw err
            })
        },
        async routeControllers(
            controllerClasses: (typeof Controller)[],
            dic: DIC,
            ...rest: ConstructorParameters<typeof Controller>
        ) {
            const routes: {
                [k: string]: ((...rest: any[]) => Awaited<any>) | undefined
            } = {}
            const controllers = (
                await context.instantiateControllers(
                    controllerClasses,
                    dic,
                    ...rest,
                )
            ).filter((c) => !!c) as Controller[]
            controllers.forEach((controller) => {
                const C = controller.constructor as typeof Controller
                const members = getControllerMembers(C)
                if (members.length > 0) {
                    const controllerRouteInfo = getRouteInfo(C)
                    members.forEach((m) => {
                        const routeInfo = getRouteInfo(controller, m)
                        const path = [controllerRouteInfo.path, routeInfo.path]
                            .filter((r) => !!r)
                            .join('.')
                        if (controller[m] instanceof Function) {
                            routes[path] = (...rest: any[]) =>
                                controller[m](...rest)
                        }
                    })
                }
            })
            return {
                routes,
                controllers: controllers,
            }
        },
        Route,
    }
    return context
}

const router = createRouter()
export const Route = router.Route
export const routeControllers = (
    ...rest: Parameters<typeof router.routeControllers>
) => router.routeControllers(...rest)
