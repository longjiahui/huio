import { createMemberMetaDecorator, getMembers } from './decoratorUtils'
import Emitter from './emitter'

type KeyType = string | symbol | (new (...rest: any[]) => any)
type Factory<
    T extends KeyType = any,
    ReturnType extends T extends new (...rest: any[]) => any
        ? InstanceType<T>
        : any = T extends new (...rest: any[]) => any ? InstanceType<T> : any,
> = (
    dic: DIC,
    ...rest: any[]
) => Promise<ReturnType | undefined> | ReturnType | undefined

// enum InjectType {
//     value = 'value',
//     get = 'get',
// }

type CustomFactoryType<T extends KeyType> = T extends new (...rest: any) => any
    ? [Factory<T>?]
    : [Factory<T>]

function isNewable(val: KeyType): val is new (...rest: any[]) => any {
    return val instanceof Function
}

type ProviderReturnType<T extends KeyType> = T extends new (
    ...rest: any[]
) => any
    ? InstanceType<T>
    : any

export class DIC extends Emitter<{
    provided: (key: KeyType, factory: Factory) => any
    disprovided: (key: KeyType, factory: Factory) => any
}> {
    private provides: Map<KeyType, Factory> = new Map()
    private providesRef: Map<KeyType, Factory>[] = []

    constructor(from?: DIC) {
        super()
        if (from) {
            // this.provides = new Map(from.provides)
            this.providesRef.push(...from.getAllProvides())
        }
    }

    connect(dic: DIC) {
        this.providesRef.push(...dic.getAllProvides())
    }

    getAllProvides() {
        return [this.provides, ...this.providesRef]
    }

    has(key: KeyType): boolean {
        return this.getAllProvides().some((p) => p.has(key))
    }
    set<T extends KeyType>(key: T, factory: Factory<T>) {
        if (this.has(key)) {
            console.warn(
                'providers provide conflict(key, factoryToBeSet, presentFactory): ',
                key,
                [factory],
                [this.make(key)],
            )
        }
        this.provides.set(key, factory)
        return this.emit('provided', key, factory)
    }

    get(key: KeyType) {
        return this.getAllProvides()
            .find((p) => p.get(key))
            ?.get(key)
    }

    async make<T extends KeyType>(key: T | KeyType, ...rest: any[]) {
        return this.makeWithTimeout<T>(key, 0, ...rest)
    }

    async makeImmediately<T extends KeyType>(key: T | KeyType, ...rest: any[]) {
        return this.makeWithTimeout<T>(key, -1, ...rest)
    }

    async makeWithTimeout<T extends KeyType>(
        key: T | KeyType,
        timeout: number,
        ...rest: any[]
    ): Promise<
        T extends new (...rest: any[]) => any
            ? InstanceType<T> | undefined
            : any
    > {
        let factory = this.get(key)
        if (null == factory) {
            if (timeout < 0) {
                factory = undefined
            } else {
                const providedPromise = new Promise<Factory>((r) => {
                    this.on('provided', (k, factory) => {
                        if (key === k) {
                            r(factory)
                        }
                    })
                })
                if (timeout > 0) {
                    factory = await Promise.race<Factory | undefined>([
                        // new Promise((_, reject) =>
                        new Promise((r, _) =>
                            setTimeout(() => {
                                console.warn('get timeout: ', key)
                                r(undefined)
                            }, timeout),
                        ),
                        providedPromise,
                    ])
                } else {
                    factory = await providedPromise
                }
            }
        }
        return factory?.(this, ...rest)
    }

    setWithInjects<
        ProviderType extends KeyType,
        T extends ProviderReturnType<ProviderType> = ProviderReturnType<ProviderType>,
    >(
        Provider: ProviderType,
        ...rest: CustomFactoryType<ProviderType> // customFactory?: Factory<ProviderType>,
    ) {
        const customFactory = rest[0]
        this.set(Provider, async (dic, ...rest: any[]) => {
            let ret: T | undefined
            if (isNewable(Provider)) {
                if (!customFactory) {
                    ret = new Provider(...rest)
                } else {
                    ret = await customFactory(dic, ...rest)
                }
            } else {
                // 这里其实一定存在，因为假如Provider不是newable的时候 这个参数是必填的
                ret = await customFactory?.(dic, ...rest)
            }

            if (ret) {
                const members = getInjectMembers(ret.constructor)
                if (members.length > 0) {
                    await Promise.all(
                        members.map(async (m) => {
                            if (ret![m] instanceof Function) {
                                // function
                                const injectDescriptors = getInjectList(ret!, m)
                                const injectParams = {}
                                for (const k of Object.keys(
                                    injectDescriptors,
                                )) {
                                    const descriptor = injectDescriptors[k]
                                    if (descriptor) {
                                        injectParams[k] =
                                            await descriptor.factory(dic)
                                    }
                                }
                                const originM = ret![m].bind(ret)
                                Object.defineProperty(ret, m, {
                                    value: (...rest) => {
                                        Object.keys(injectParams).forEach(
                                            (i) => {
                                                rest[i] = injectParams[i]
                                            },
                                        )
                                        return originM(...rest)
                                    },
                                })
                            } else {
                                // properties
                                Object.defineProperty(ret, m, {
                                    value: await getInject(ret!, m)?.(dic),
                                })
                            }
                        }),
                    )
                }
            }
            return ret
        })
    }
}
// 扩展DI Provide
type ProvideDescriptor<T extends KeyType = KeyType> = {
    key?: T
    factory: Factory<T>
}

function isFactory<T extends KeyType>(
    val: Factory<T> | ProvideDescriptor<T>,
): val is Factory<T> {
    return val instanceof Function
}

export function createDIC(from?: DIC) {
    const dic = new DIC(from)
    function Provide<T extends new (...rest: any[]) => any>(
        descriptors?: ProvideDescriptor[] | ProvideDescriptor | Factory<T>,
    ) {
        return (target: T) => {
            if (!descriptors) {
                descriptors = {
                    key: target,
                    factory: () => new target(),
                }
            }
            if (!(descriptors instanceof Array)) {
                if (isFactory(descriptors)) {
                    descriptors = {
                        // warning
                        key: target,
                        factory: descriptors,
                    }
                }
                descriptors = [descriptors]
            }
            descriptors.forEach((d) => {
                dic.setWithInjects(d.key || target, d.factory)
            })
        }
    }

    return {
        dic,
        Provide,
    }
}

const injectKey = Symbol.for('inject')

const decoratorKey = Symbol.for('injectDecorator')

export function Inject<T extends KeyType>(factory: Factory<T>) {
    return createMemberMetaDecorator(
        (
            target: (new (...rest: any[]) => any) | object,
            key: string | symbol | undefined,
            index: number | undefined,
        ) => {
            if (!!key && typeof index === 'number') {
                addInject(factory, target, key, index)
            } else {
                if (key) {
                    Reflect.defineMetadata(injectKey, factory, target, key)
                } else {
                    Reflect.defineMetadata(injectKey, factory, target)
                }
            }
        },
        decoratorKey,
    )
}
export function getInjectMembers(target) {
    return getMembers(target, decoratorKey)
}
Inject.key = <T extends KeyType>(key: T, timeout = -1) => {
    return Inject((dic) => dic.makeWithTimeout(key, timeout))
}
Inject.const = (val: any) => {
    return Inject(() => val)
}

type InjectFactory = (dic: DIC) => Awaited<any>
interface InjectParamDescriptor {
    factory: InjectFactory
}

type InjectList = {
    [key: string | symbol | number]: InjectParamDescriptor | undefined
}

const injectListKey = Symbol.for('injectList')
function getInject(
    target: object,
    key: string | symbol,
): InjectFactory | undefined {
    return Reflect.getMetadata(injectKey, target, key)
}
function addInject(
    factory: Factory,
    target: object,
    key: string | symbol,
    index: number,
) {
    const injectList: InjectList =
        Reflect.getMetadata('injectListKey', target, key) || {}
    injectList[index] = {
        factory,
    }
    Reflect.defineMetadata(injectListKey, injectList, target, key)
}

function getInjectList(target: object, key: string | symbol): InjectList {
    return Reflect.getMetadata(injectListKey, target, key) || {}
}
