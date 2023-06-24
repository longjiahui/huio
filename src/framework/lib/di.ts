import { createMemberMetaDecorator, getMembers } from './decoratorUtils'
import Emitter from './emitter'

type KeyType = string | symbol | (new (...rest: any[]) => any)
type Factory<T extends KeyType = any> = (
    dic: DIC,
    ...rest: any[]
) => Awaited<T extends new (...rest: any[]) => any ? InstanceType<T> : any>

export class DIC extends Emitter<{
    provided: (key: KeyType, factory: Factory) => any
    disprovided: (key: KeyType, factory: Factory) => any
}> {
    private provides: Map<KeyType, Factory> = new Map()

    constructor(from?: DIC) {
        super()
        if (from) {
            this.provides = new Map(from.provides)
        }
    }

    has(key: KeyType): boolean {
        return this.provides.has(key)
    }
    set<T extends KeyType>(key: T, factory: Factory<T>) {
        if (this.has(key)) {
            console.warn(
                'providers provide conflict(key, factoryToBeSet, presentFactory): ',
                key,
                [factory],
                [this.get(key)],
            )
        }
        this.provides.set(key, factory)
        return this.emit('provided', key, factory)
    }

    async get<T extends KeyType>(key: T | KeyType, ...rest: any[]) {
        return this.getWithTimeout<T>(key, 0, ...rest)
    }

    async getWithTimeout<T extends KeyType>(
        key: T | KeyType,
        timeout: number,
        ...rest: any[]
    ): Promise<
        T extends new (...rest: any[]) => any
            ? InstanceType<T> | undefined
            : any
    > {
        let factory = this.provides.get(key)
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
}
// 扩展DI Provide
type ProvideDescriptor<T extends KeyType> = {
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
    function Provide<T extends KeyType>(
        descriptors: ProvideDescriptor<T>[] | ProvideDescriptor<T> | Factory<T>,
    ) {
        return (target: new (...rest: any[]) => any) => {
            if (!(descriptors instanceof Array)) {
                if (isFactory(descriptors)) {
                    descriptors = {
                        // warning
                        key: target as any,
                        factory: descriptors,
                    }
                }
                descriptors = [descriptors]
            }
            descriptors.forEach((d) => {
                if (d.factory) {
                    dic.set(
                        d.key || target,
                        async (dic: DIC, ...rest: any[]) => {
                            const ret = await d.factory(dic, ...rest)
                            const members = getInjectMembers(target)
                            if (members.length > 0) {
                                await Promise.all(
                                    members.map(async (m) => {
                                        if (ret[m] instanceof Function) {
                                            // function
                                            const injectDescriptors =
                                                getInjectList(ret, m)
                                            const injectParams = {}
                                            for (const k of Object.keys(
                                                injectDescriptors,
                                            )) {
                                                const descriptor =
                                                    injectDescriptors[k]
                                                if (descriptor) {
                                                    injectParams[k] =
                                                        await descriptor.factory(
                                                            dic,
                                                        )
                                                }
                                            }
                                            const originM = ret[m].bind(ret)
                                            Object.defineProperty(ret, m, {
                                                value: (...rest) => {
                                                    Object.keys(
                                                        injectParams,
                                                    ).forEach((i) => {
                                                        rest[i] =
                                                            injectParams[i]
                                                    })
                                                    return originM(...rest)
                                                },
                                            })
                                        } else {
                                            // properties
                                            Object.defineProperty(ret, m, {
                                                value: await getInject(
                                                    ret,
                                                    m,
                                                )?.(dic),
                                            })
                                        }
                                    }),
                                )
                            }
                            return ret
                        },
                    )
                }
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
    return Inject((dic) => dic.getWithTimeout(key, timeout))
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

// export function getInjectable(
//     target: object | (new (...rest: any[]) => any),
//     key?: string | symbol,
// ) {
//     return Reflect.getMetadata(injectableKey, target, key)
// }

// export function setInjectable(target: object | (new (...rest: any[])=>any), key?:string|symbol){
//     Reflect.defineMetadata(injectableKey, target, key)
// }

// export function DI() {
//     return MemberMetaDecorator(Reflect.metadata(injectableKey, true))
// }

// export function Inject<T = any>(factory: Factory<T>) {
//     return (target: object, key: string | symbol, index: number) => {
//         if (
//             (!!key && target[key] instanceof Function) ||
//             (target instanceof Function && !key)
//         ) {
//             addInject(factory, target, key, index)
//         }
//     }
// }
// Inject.Token = (val: string) => Inject((center: DIC) => center.get(val))
// Inject.Const = <T = any>(val: T) => Inject(() => val)

// 这部分其实应该是 provide的额逻辑
// private async _buildProvider<T extends new (...rest: any[]) => any = any>(
//     target: T | (new (...rest: any[]) => any),
//     // 构造参数
//     ...rest: any[]
// ): Promise<any> {
//     const members = getMembers(target)
//     const isInjectable = getInjectable(target)
//     if (members.length === 0 && !isInjectable) {
//         // 没有注入的类
//         // 如果是基础类型，则直接返回基础类型
//         // if (target === Number) {
//         //     return 0
//         // } else if (target === String) {
//         //     return ''
//         // } else if (target === Boolean) {
//         //     return false
//         // } else {
//         //     // 返回Undefined
//         //     // return new target(...rest)
//         // }
//         // 应该返回undefined，因为没有提供
//         return undefined
//     } else {
//         let instance: InstanceType<T>
//         if (isInjectable) {
//             // 构造函数注入
//             const types = getParamTypes(target)
//             const injectDescriptors = getInjectList(target)
//             const injectedParams = await Promise.all(
//                 types.map(async (t, i) => {
//                     if (injectDescriptors[i]) {
//                         return injectDescriptors[i].factory(this)
//                     } else {
//                         return this.get(t)
//                     }
//                 }),
//             )
//             instance = new target(...injectedParams, ...rest)
//         } else {
//             // 成员需要被注入，构造函数不需要被注入
//             instance = new target(...rest)
//         }
//         for (const k of members) {
//             const member = instance[k]
//             if (member instanceof Function) {
//                 // 成员函数
//                 const types = getParamTypes(instance, k)
//                 const injectDescriptors = getInjectList(instance, k)
//                 const injectedParams = await Promise.all(
//                     types.map(async (t, i) => {
//                         if (injectDescriptors[i]) {
//                             return injectDescriptors[i].factory(this)
//                         } else {
//                             return this.get(t)
//                         }
//                     }),
//                 )
//                 const originK = instance[k]
//                 Object.defineProperty(instance, k, {
//                     value: (...rest) => originK(...injectedParams, ...rest),
//                 })
//             } else {
//                 // 成员属性
//                 const type = getType(instance, k)
//                 Object.defineProperty(instance, k, {
//                     value: await this.get(type),
//                 })
//             }
//         }
//         return instance
//     }
// }
