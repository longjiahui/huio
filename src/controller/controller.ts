import { v1 as uuid } from 'uuid'
import 'reflect-metadata'

const routePathKey = Symbol.for('routePath')
const routeClassIdKey = Symbol.for('routeClassId')

const routeKeys: { [key: string]: (string | symbol)[] | undefined } = {}
const Controllers: (new (...rest: any[]) => any)[] = []

export function Route(path: string) {
    return (target: object, key?: string | symbol) => {
        const metaTarget = key ? target[key] : target
        Reflect.defineMetadata(routeClassIdKey, uuid(), target, key)
        Reflect.defineMetadata(routePathKey, path, target, key)
        if (key === undefined) {
            Controllers.push(target as any)
        }
        if (target[key] instanceof Function) {
            if (
                !!key &&
                !(routeKeys[target.constructor.name] instanceof Array)
            ) {
                routeKeys[target.constructor.name] = []
            }
            routeKeys[target.constructor.name].push(key)
        }
        return metaTarget
    }
}

export interface RouteItem {
    path: string
    handler: (...rest: any[]) => Promise<any[]> | any[]
}

export function mapRoutes(Controllers: (new (...args: any[]) => any)[]) {
    const routes: { [key: string]: RouteItem | undefined } = {}
    for (const C of Controllers) {
        const id: string | undefined = Reflect.getMetadata(routeClassIdKey, C)
        if (id) {
            const path = Reflect.getMetadata(routePathKey, C) || '/'
            const c = new C()
            const keys = routeKeys[C.name] || []
            for (const k of keys) {
                const mPath = Reflect.getMetadata(routePathKey, c, k) || '/'
                routes[id] = {
                    path: path + mPath,
                    handler: c[k],
                }
            }
        }
    }
    return Object.values(routes)
}
export function mapAllRoutes() {
    return mapRoutes(Controllers)
}
