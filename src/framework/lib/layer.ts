import Yallist from 'yallist'

type ToArray<T> = T extends any[] ? T : [T]

type MiddlewareHandler<A, B> = (
    next: (...rest: ToArray<A>) => Awaited<B>,
    ...params: ToArray<A>
) => Awaited<B>
type FinalMiddlewareHandler<A, B> = (...params: ToArray<A>) => Awaited<B>

export class Middleware<ParamsType = any, LinkType = void> {
    constructor(public handler: MiddlewareHandler<ParamsType, LinkType>) {}
}

/**
 * ParamsType: P
 * LinkType: L
 */
export class Layer<P = any, L = any> {
    middlewares: Yallist<Middleware<P, L>> = Yallist.create()
    // finalMiddleware: Middleware<P, L>
    finalMiddlewareHandler: FinalMiddlewareHandler<P, L>

    constructor(finalMiddlewareHandler: FinalMiddlewareHandler<P, L>) {
        this.finalMiddlewareHandler = finalMiddlewareHandler
        // this.finalMiddleware = new Middleware<P, L>((next, layer, ...params) =>
        //     finalMiddlewareHandler(layer, ...params),
        // )
    }

    install(middlewareHandler: MiddlewareHandler<P, L>, index?: number) {
        index = index == null ? this.middlewares.length : index
        this.middlewares.splice(index, 0, new Middleware(middlewareHandler))
    }

    uninstall(handler: MiddlewareHandler<P, L> | number) {
        if (typeof handler === 'number') {
            this.middlewares.splice(handler, 1)
        } else {
            const index = this.middlewares
                .toArray()
                .findIndex((m) => m.handler === handler)
            if (index > -1) {
                this.middlewares.splice(index, 1)
            }
        }
    }

    async go(...params: ToArray<P>) {
        const call = (
            node: NonNullable<typeof this.middlewares.head> | null,
            params: ToArray<P>,
        ): Awaited<L> =>
            node?.value == null
                ? this.finalMiddlewareHandler(...params)
                : node.value.handler(
                      (...params: ToArray<P>) => call(node.next, params),
                      ...params,
                  )
        const middlewares = Yallist.create([...this.middlewares])
        return call(middlewares.head, params)
    }
}
