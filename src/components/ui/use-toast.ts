"use client"

import * as React from "react"

export type ToastVariant = "default" | "destructive" | "success" | "warning"

export interface ToastData {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  variant?: ToastVariant
  duration?: number
}

type Action =
  | { type: "ADD_TOAST"; toast: ToastData }
  | { type: "UPDATE_TOAST"; toast: Partial<ToastData> & { id: string } }
  | { type: "DISMISS_TOAST"; toastId?: string }
  | { type: "REMOVE_TOAST"; toastId?: string }

interface State {
  toasts: ToastData[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string, duration = 4000) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId,
    })
  }, duration)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, 5),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      if (toastId) {
        addToRemoveQueue(toastId, 0)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id, 0)
        })
      }

      return state
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

export type ToastInput = Omit<ToastData, "id"> & { id?: string }

function toast(props: ToastInput | string) {
  const input: ToastInput = typeof props === "string" ? { description: props } : props
  const id = input.id || Math.random().toString(36).substring(2, 9)

  const update = (props: ToastInput) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...input,
      id,
    },
  })

  addToRemoveQueue(id, input.duration ?? 4000)

  return {
    id,
    dismiss,
    update,
  }
}

toast.error = (description: React.ReactNode, title = "Erro") => {
  return toast({ title, description, variant: "destructive" })
}

toast.success = (description: React.ReactNode, title = "Sucesso") => {
  return toast({ title, description, variant: "success" })
}

toast.warning = (description: React.ReactNode, title = "Atenção") => {
  return toast({ title, description, variant: "warning" })
}

toast.info = (description: React.ReactNode, title = "Informação") => {
  return toast({ title, description, variant: "default" })
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast }
