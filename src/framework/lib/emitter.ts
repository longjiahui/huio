const forAllChannel = 'forAll'

enum CallBackType {
    on = 'on',
    once = 'once',
}

type ChannelType = string | symbol | number
type HandlerType = (...rest: any[]) => any
type EventsType = { [k: ChannelType]: HandlerType }

class _Emitter<Events extends EventsType> {
    private callbacks: Partial<{
        [key in keyof Events]:
            | { type: CallBackType; handler: HandlerType }[]
            | undefined
    }> = {}

    _confirmCMDFunc(channel: keyof Events) {
        if (!(this.callbacks[channel] instanceof Array)) {
            this.callbacks[channel] = []
        }
    }
    // id 用来获取返回
    on<K extends keyof Events>(channel: K, handler: Events[K]) {
        this._confirmCMDFunc(channel)
        this.callbacks[channel]?.push({
            type: CallBackType.on,
            handler,
        })
        return this
    }
    once<K extends keyof Events>(channel: K, handler: Events[K]) {
        this._confirmCMDFunc(channel)
        this.callbacks[channel]?.push({
            type: CallBackType.once,
            handler,
        })
        return this
    }
    emit<K extends keyof Events>(
        channel: K,
        ...rest: Parameters<NonNullable<Events[K]>>
    ) {
        let promise: Promise<ReturnType<NonNullable<Events[K]>>[]>
        if ((this.callbacks[channel]?.length as number) > 0) {
            const callbacks = this.callbacks[channel]!
            promise = Promise.all(
                callbacks.map((callback) => {
                    return callback.handler(...rest)
                }),
            ).finally(() => {
                // removeAll Once Func
                this.callbacks[channel] = callbacks.filter(
                    (c) => c.type !== CallBackType.once,
                )
            })
        } else {
            promise = Promise.resolve([])
        }
        return this.wrapFirstToPromise(promise)
    }

    wrapFirstToPromise(promise: Promise<any[]>) {
        return Object.assign(promise, {
            first: () => promise.then((d) => d[0]),
        })
    }
}

type ForAllEvents<Events extends EventsType> = {
    [forAllChannel]: (
        channel: keyof Events,
        ...rest: Parameters<NonNullable<Events[keyof Events]>>
    ) => void
}

type OnAllHandlerType<Events extends EventsType> = (
    channel: keyof Events,
    ...rest: Parameters<NonNullable<Events[keyof Events]>>
) => void

class Emitter<Events extends EventsType> extends _Emitter<Events> {
    // 用来监听所有的事件emit
    private forAll = new _Emitter<ForAllEvents<Events>>()

    constructor() {
        super()
    }
    onAll(callback: OnAllHandlerType<Events>) {
        return this.forAll.on(forAllChannel, callback)
    }
    onceAll(callback: (...rest: any[]) => any) {
        this.forAll.once(forAllChannel, callback)
    }
    emit<K extends keyof Events>(
        channel: K,
        ...rest: Parameters<NonNullable<Events[K]>>
    ) {
        const ret = Promise.all([
            this.forAll.emit(forAllChannel, channel, ...rest),
            super.emit(channel, ...rest),
        ]).then(([_, ret]) => {
            return ret
        })
        return super.wrapFirstToPromise(ret)
    }
}

export default Emitter
