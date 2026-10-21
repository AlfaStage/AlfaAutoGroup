'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { ArrowLeft } from 'lucide-react'

export interface WhatsAppPreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  previewSchedule: any
  groupName: string
}

export function WhatsAppPreviewModal({
  open,
  onOpenChange,
  previewSchedule,
  groupName,
}: WhatsAppPreviewModalProps) {
  if (!previewSchedule) return null

  const s = previewSchedule
  let c: any = {}
  try {
    c = typeof s.content === 'string' ? JSON.parse(s.content) : s.content || {}
  } catch (e) {
    c = {}
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] bg-[#efeae2] p-0 border-none rounded-xl overflow-hidden shadow-2xl">
        <div className="bg-[#008069] text-white p-4 flex items-center gap-3">
          <ArrowLeft
            className="w-5 h-5 cursor-pointer opacity-80 hover:opacity-100"
            onClick={() => onOpenChange(false)}
          />
          <div>
            <div className="font-semibold">{groupName}</div>
            <div className="text-xs opacity-80">Você</div>
          </div>
        </div>

        <div className="p-4 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat opacity-90 h-[400px] overflow-y-auto flex flex-col">
          <div className="bg-[#d9fdd3] text-[#111b21] p-2 rounded-lg rounded-tr-none shadow-sm max-w-[90%] self-end relative pb-6 mb-4">
            {s.type === 'text' && (
              <p className="whitespace-pre-wrap text-sm m-0 leading-relaxed">
                {c.text}
              </p>
            )}

            {s.type === 'media' && (
              <div>
                <div className="w-full h-32 bg-black/10 rounded mb-2 flex items-center justify-center font-bold text-black/40 text-xs">
                  {c.mediatype?.toUpperCase() || 'MÍDIA'}
                </div>
                {c.caption && (
                  <p className="text-sm m-0 leading-relaxed">{c.caption}</p>
                )}
              </div>
            )}

            {s.type === 'button' && (
              <div>
                {c.imageUrl && (
                  <div
                    className="w-full h-24 bg-cover bg-center rounded mb-2"
                    style={{ backgroundImage: `url(${c.imageUrl})` }}
                  />
                )}
                {c.videoUrl && (
                  <div className="w-full h-24 bg-black/10 rounded mb-2 flex items-center justify-center font-bold text-black/40">
                    VÍDEO
                  </div>
                )}
                <b className="text-sm block leading-tight">{c.title}</b>
                <p className="text-sm my-1 text-black/80">{c.description}</p>
                {c.footer && (
                  <div className="text-xs text-black/50">{c.footer}</div>
                )}
                {c.buttons?.length > 0 && (
                  <hr className="border-black/10 my-2" />
                )}
                <div className="space-y-2">
                  {c.buttons?.map((b: any, i: number) => (
                    <div
                      key={i}
                      className={`text-[#00a884] text-center text-sm font-bold pt-2 ${
                        i > 0 ? 'border-t border-black/10' : ''
                      }`}
                    >
                      {b.displayText} {b.type !== 'reply' && '↗'}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {s.type === 'poll' && (
              <div>
                <b className="text-sm block mb-2">📊 {c.name}</b>
                <div className="space-y-1">
                  {c.values?.map((v: any, i: number) => (
                    <div
                      key={i}
                      className="bg-white/50 border border-black/10 p-2 text-sm rounded-md shadow-sm"
                    >
                      ⚪ {v}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="absolute bottom-1 right-2 text-[0.65rem] text-black/40 flex items-center gap-1">
              {s.adjustedAt
                ? new Date(s.adjustedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : ''}
              <span className="text-[#53bdeb] font-bold text-xs">✓✓</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default WhatsAppPreviewModal
