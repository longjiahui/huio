import 'reflect-metadata'
import {
    MemberMetaDecorator,
    getMembers,
    getParamTypes,
    getType,
} from '@/decoratorUtils'

export const injectableKey = Symbol.for('injectable')
export const injectListKey = Symbol.for('injectList')

type Factory<T = any> = (_: DIC) => Promise<T> | T

interface InjectParamDescriptor {
    factory: Factory
}

type InjectList = {
    [key: string]: InjectParamDescriptor | undefined
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

function getInjectList(target: object, key?: string | symbol): InjectList {
    return Reflect.getMetadata(injectListKey, target, key) || {}
}

export function getInjectable(
    target: object | (new (...rest: any[]) => any),
    key?: string | symbol,
) {
    return Reflect.getMetadata(injectableKey, target, key)
}

// export function setInjectable(target: object | (new (...rest: any[])=>any), key?:string|symbol){
//     Reflect.defineMetadata(injectableKey, target, key)
// }

export function DI() {
    return MemberMetaDecorator(Reflect.metadata(injectableKey, true))
}

export function Inject<T = any>(factory: string | Factory<T>) {
    let finalFactory: Factory
    if (typeof factory === 'string') {
        const token = factory
        finalFactory = (center: DIC) => center.get(token)
    } else {
        finalFactory = factory
    }
    return (target: object, key: string | symbol, index: number) => {
        if (!!key && target[key] instanceof Function) {
            addInject(finalFactory, target, key, index)
        }
    }
}

export class DIC {
    private providers: { [key: string]: any } = {}

    provide(token: string, obj: any) {
        this.providers[token] = obj
    }

    async get<T extends new (...rest: any[]) => any>(
        arg: string | (new (...rest: any[]) => any) | T,
        ...rest: any[]
    ): Promise<InstanceType<T>> {
        if (typeof arg === 'string') {
            return this._getByToken(arg)
        } else {
            return this._getByTarget<T>(arg, ...rest)
        }
    }

    private async _getByToken(token: string) {
        const provider = this.providers[token]
        if (provider instanceof Function) {
            // factory
            return await provider()
        } else {
            return provider
        }
    }

    private async _getByTarget<T extends new (...rest: any[]) => any = any>(
        target: T | (new (...rest: any[]) => any),
        // 构造参数
        ...rest: any[]
    ): Promise<any> {
        const members = getMembers(target)
        const isInjectable = getInjectable(target)
        if (members.length === 0 && !isInjectable) {
            // 没有注入的类、直接生成
            // 如果是基础类型，则直接返回基础类型
            if (target === Number) {
                return 0
            } else if (target === String) {
                return ''
            } else if (target === Boolean) {
                return false
            } else {
                return new target(...rest)
            }
        } else {
            let instance: InstanceType<T>
            if (isInjectable) {
                // 构造函数注入
                const types = getParamTypes(target)
                const injectDescriptors = getInjectList(target)
                const injectedParams = await Promise.all(
                    types.map(async (t, i) => {
                        if (injectDescriptors[i]) {
                            return injectDescriptors[i].factory(this)
                        } else {
                            return this._getByTarget(t)
                        }
                    }),
                )
                instance = new target(...injectedParams, ...rest)
            } else {
                // 成员需要被注入，构造函数不需要被注入
                instance = new target(...rest)
            }
            for (const k of members) {
                const member = instance[k]
                if (member instanceof Function) {
                    // 成员函数
                    const types = getParamTypes(instance, k)
                    const injectDescriptors = getInjectList(instance, k)
                    const injectedParams = await Promise.all(
                        types.map(async (t, i) => {
                            if (injectDescriptors[i]) {
                                return injectDescriptors[i].factory(this)
                            } else {
                                return this._getByTarget(t)
                            }
                        }),
                    )
                    const originK = instance[k]
                    Object.defineProperty(instance, k, {
                        value: (...rest) => originK(...injectedParams, ...rest),
                    })
                } else {
                    // 成员属性
                    const type = getType(instance, k)
                    Object.defineProperty(instance, k, {
                        value: await this._getByTarget(type),
                    })
                }
            }
            return instance
        }
    }
}
