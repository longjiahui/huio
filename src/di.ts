import 'reflect-metadata'

const injectableKey = Symbol.for('injectable')
const injectListKey = Symbol.for('injectList')

export function DI() {
    return Reflect.metadata(injectableKey, true)
}

type Factory<T = any> = (_: DICenter) => T

interface InjectParamDescriptor {
    factory: Factory
}

export function Inject<T>(factory: string | Factory<T>) {
    let finalFactory: Factory
    if (typeof factory === 'string') {
        const token = factory
        finalFactory = (center: DICenter) => center._getByToken(token)
    } else {
        finalFactory = factory
    }
    return (target: object, key: string | symbol, index: number) => {
        if (!!key && target[key] instanceof Function) {
            const injectList: {
                [key: string]: InjectParamDescriptor | undefined
            } = Reflect.getMetadata('injectListKey', target, key) || {}
            injectList[index] = {
                factory: finalFactory,
            }
            Reflect.defineMetadata(injectListKey, injectList, target, key)
        }
    }
}

export class DICenter {
    providers: { [key: string]: any } = {}

    _getByToken(token: string) {
        return this.providers[token]
    }
    get(target: (new (...rest: any[]) => any) | object, key?: string | symbol) {
        if (
            (!!target &&
                typeof target === 'object' &&
                target[key] instanceof Function) ||
            target instanceof Function
        ) {
            // 构造函数
            // 注入构造函数参数
            const types: (new (...rest: any[]) => any)[] =
                Reflect.getMetadata('design:paramtypes', target, key) || []
            const injectDescriptors: InjectParamDescriptor[] =
                Reflect.getMetadata(injectListKey, target, key) || []
            const rest = types.map((t, i) => {
                if (injectDescriptors[i]) {
                    return injectDescriptors[i].factory(this)
                } else {
                    return this.get(t)
                }
            })
            if (typeof target === 'object') {
                if (Reflect.getMetadata(injectableKey, target.constructor)) {
                    // 成员函数
                    return (...params) => target[key](...rest, ...params)
                } else {
                    return (...params) => target[key](...params)
                }
            } else {
                // 构造函数
                if (!Reflect.getMetadata(injectableKey, target)) {
                    return new target()
                } else {
                    return new target(...rest)
                }
            }
        } else if (!!key && !(target[key] instanceof Function)) {
            // 成员属性
            console.debug(Reflect.getMetadata('design:type', target, key))
        }
    }
}
