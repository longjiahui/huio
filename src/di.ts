import 'reflect-metadata'
import {
    MemberMetaDecorator,
    getMembers,
    getParamTypes,
    getType,
} from '@/decoratorUtils'
import EventEmitter from 'eventemitter3'

export const injectableKey = Symbol.for('injectable')
export const injectListKey = Symbol.for('injectList')

type TokenType = string | symbol | (new (...rest: any[])=>any)
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

export function Inject<T = any>(factory: Factory<T>) {
    return (target: object, key: string | symbol, index: number) => {
        if (
            (!!key && target[key] instanceof Function) ||
            (target instanceof Function && !key)
        ) {
            addInject(factory, target, key, index)
        }
    }
}
Inject.Token = (val: string) => Inject((center: DIC) => center.get(val))
Inject.Const = <T = any>(val: T) => Inject(() => val)

export class DIC {
    private providers: Map<string | (new (...rest: any[]) => any), any> =
        new Map()

    provide(token: string | (new (...rest: any[]) => any), obj: any) {
        this.providers.set(token, obj)
    }

    // async get<T extends new (...rest: any[]) => any>(
    //     arg: string | (new (...rest: any[]) => any) | T,
    //     ...rest: any[]
    // ): Promise<InstanceType<T>> {
    //     if (typeof arg === 'string') {
    //         return this._getByToken(arg)
    //     } else {
    //         return this._getByTarget<T>(arg, ...rest)
    //     }
    // }
    async get<T>(arg: string | (new (...rest: any[]) => T)) {
        return (this.providers as Map<any, T>).get(arg)
    }

    // 这部分其实应该是 provide的额逻辑
    private async _provide<T extends new (...rest: any[]) => any = any>(
        target: T | (new (...rest: any[]) => any),
        // 构造参数
        ...rest: any[]
    ): Promise<any> {
        const members = getMembers(target)
        const isInjectable = getInjectable(target)
        if (members.length === 0 && !isInjectable) {
            // 没有注入的类
            // 如果是基础类型，则直接返回基础类型
            // if (target === Number) {
            //     return 0
            // } else if (target === String) {
            //     return ''
            // } else if (target === Boolean) {
            //     return false
            // } else {
            //     // 返回Undefined
            //     // return new target(...rest)
            // }
            // 应该返回undefined，因为没有提供
            return undefined
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
                            return this.get(t)
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
                                return this.get(t)
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
                        value: await this.get(type),
                    })
                }
            }
            return instance
        }
    }
}

const provideKey = Symbol.for('provide')

enum LifeEmitterEvent {
    create = 'create',
    destroy = 'destroy',
}
interface LifeEmitter {
    create: () => void
    destroy: () => void
}
class Life extends EventEmitter<LifeEmitter> {
    static create() {
        const emitter = new Life()
        return {
            on: <T extends LifeEmitterEvent>(
                event: T,
                handler: LifeEmitter[T],
            ) => emitter.on(event, handler),
            emit: <T extends LifeEmitterEvent>(
                event: T,
                ...rest: Parameters<LifeEmitter[T]>
            ) => emitter.emit(event, ...rest),
        }
    }
}

// 扩展DI Provide
type ProvideDescriptor = {
    life: LifeEmitter,
    token?: string | symbol | 
}
export function Provide(descriptors: { life: LifeEmitter; token?: string }[]) {
    // return (target: new (...rest: any[]) => any) => {
    //     Reflect.defineMetadata(provideKey, token, target)
    // }
    // return Reflect.metadata(provideKey, token)
}

// Provide.Life = (emitter: any) => {
//     return (target: new (...rest: any[]) => any) => {

//     }
// }
