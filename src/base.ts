import Yallist from 'yallist'

type MiddlewareHandler<A extends any[], B> = (
    next: () => Promise<B>,
    stream: Stream<A, B>,
    ...params: A
) => Promise<B> | void
type FinalMiddlewareHandler<A extends any[], B> = (
    stream: Stream<A, B>,
    ...params: A
) => Promise<B> | void

export class Middleware<ParamsType extends any[] = any[], LinkType = void> {
    constructor(public handler: MiddlewareHandler<ParamsType, LinkType>) {}
}

/**
 * ParamsType: P
 * LinkType: L
 */
export class Stream<P extends any[] = any[], L = any> {
    name: string
    middlewares: Yallist<Middleware<P, L>> = Yallist.create()
    finalMiddleware: Middleware<P, L>

    constructor(
        name: string,
        finalMiddlewareHandler: FinalMiddlewareHandler<P, L>,
    ) {
        this.name = name
        this.finalMiddleware = new Middleware<P, L>((next, stream, ...params) =>
            finalMiddlewareHandler(stream, ...params),
        )
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
                this.middlewares.slice(index, 1)
            }
        }
    }

    async go(...params: P) {
        const call = (
            node: NonNullable<typeof this.middlewares.head>,
            params: P,
        ): any =>
            node.value.handler(
                async () => node.next?.value && call(node.next, params),
                this,
                ...params,
            )
        const middlewares = Yallist.create([
            ...this.middlewares,
            this.finalMiddleware,
        ])
        if (middlewares.head) {
            return call(middlewares.head, params)
        }
    }
}
