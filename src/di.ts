import 'reflect-metadata'
// import {
//     MemberMetaDecorator,
//     getMembers,
//     getParamTypes,
//     getType,
// } from '@/decoratorUtils'
import Emitter from './emitter'

// export const injectableKey = Symbol.for('injectable')
// export const injectListKey = Symbol.for('injectList')

type TokenType = string | symbol | (new (...rest: any[]) => any)
// type Factory<T = any> = (_: DIC) => Promise<T> | T

// interface InjectParamDescriptor {
//     factory: Factory
// }

// type InjectList = {
//     [key: string]: InjectParamDescriptor | undefined
// }

// function addInject(
//     factory: Factory,
//     target: object,
//     key: string | symbol,
//     index: number,
// ) {
//     const injectList: InjectList =
//         Reflect.getMetadata('injectListKey', target, key) || {}
//     injectList[index] = {
//         factory,
//     }
//     Reflect.defineMetadata(injectListKey, injectList, target, key)
// }

// function getInjectList(target: object, key?: string | symbol): InjectList {
//     return Reflect.getMetadata(injectListKey, target, key) || {}
// }

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

const provides = new Map<TokenType, ProvideDescriptor[]>()

export class DIC extends Map<TokenType, any> {
    constructor() {
        super()
        for (const token of provides.keys()) {
            const ds = provides.get(token)
            ds?.forEach((d) => {
                let data
                d.life.on('create', async () => {
                    if (this.has(token)) {
                        console.warn(
                            'providers create lifes conflict(token, data): ',
                            token,
                            data,
                        )
                    } else {
                        this.provide(token, ((data = await d.factory()), data))
                    }
                })
                d.life.on('destroy', () => {
                    if (data === this.get(token)) {
                        this.delete(token)
                    } else {
                        //
                        console.warn(
                            'providers destroy lifes conflict(token, data): ',
                            token,
                            data,
                        )
                    }
                })
            })
        }
    }

    provide(token: TokenType, obj: any) {
        if (this.has(token)) {
            console.warn(
                'providers provide conflict(token, dataToBeSet, presentData): ',
                token,
                obj,
                this.get(token),
            )
        }
        this.set(token, obj)
    }

    get<T extends TokenType>(
        token: T,
    ):
        | (T extends new (...rest: any[]) => any ? InstanceType<T> : any)
        | undefined {
        return super.get(token)
    }

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
}

type LifeEmitter = {
    create: () => void
    destroy: () => void
}
export class Life extends Emitter<LifeEmitter> {}

// 扩展DI Provide
type ProvideDescriptor<T = any> = {
    life: Life
    // target: new (...rest: any[]) => any
    factory: () => Awaited<T>
    token?: TokenType
}
// type ProvideDescriptorWithoutTarget = Omit<ProvideDescriptor, 'target'>

export function Provide<T = any>(
    descriptors: ProvideDescriptor<T>[] | ProvideDescriptor<T>,
) {
    return (target: new (...rest: any[]) => any) => {
        if (!(descriptors instanceof Array)) {
            descriptors = [descriptors]
        }
        provides.set(
            target,
            // descriptors.map((d) => ({ ...d, target })),
            descriptors,
        )
    }
}
