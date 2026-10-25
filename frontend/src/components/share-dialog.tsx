import { useState, type ReactNode } from 'react'
import { Check, Copy, MessageCircle, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { PUBLIC_URL } from '@/lib/api'

/** Share a public, read-only page (tournament or match) — WhatsApp, copy, or the phone's share sheet. */
export function ShareDialog({ path, title, message, trigger }: { path: string; title: string; message: string; trigger?: ReactNode }) {
  const [copied, setCopied] = useState(false)
  const url = `${PUBLIC_URL}${path}`
  const text = `${message}\n${url}`
  const isLocal = /localhost|127\.0\.0\.1/.test(url)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Link copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy — select the link and copy it manually')
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? <Button><Share2 /> Share</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share {title}</DialogTitle>
          <DialogDescription>
            Anyone with this link can follow live scores, the points table and player stats. They can't edit anything.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input readOnly value={url} onFocus={(event) => event.target.select()} className="tabular" />
          <Button variant="outline" size="icon" onClick={copy} aria-label="Copy link">
            {copied ? <Check className="text-success" /> : <Copy />}
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button asChild className="bg-[#25D366] text-white hover:bg-[#1ebe5b]">
            <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
              <MessageCircle /> WhatsApp
            </a>
          </Button>
          {'share' in navigator ? (
            <Button variant="outline" onClick={() => navigator.share({ title, text: message, url }).catch(() => {})}>
              <Share2 /> More options
            </Button>
          ) : (
            <Button variant="outline" onClick={copy}><Copy /> Copy link</Button>
          )}
        </div>
        {isLocal && (
          <p className="rounded-lg bg-accent px-3 py-2 text-xs text-accent-foreground">
            This link points at your computer, so it only opens on this machine. Deploy the app and set
            <code className="mx-1 font-semibold">VITE_PUBLIC_URL</code> so friends can open it.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
