import { createDIC } from '@/framework/lib/di'

const dicContext = createDIC()

export const dic = dicContext.dic
export const Provide = dicContext.Provide
