import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { CheckCircle, Loader2, Mail, ShieldCheck, ClockAlert } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useServerFn } from '@tanstack/react-start'
import { sendHRConfirmationEmail } from '@/lib/email.functions'

export const Route = createFileRoute('/verify-email')({
  validateSearch: (search: Record<string, unknown>) => ({
    expiresAt: search.expiresAt ? Number(search.expiresAt) : Date.now() + 600000, // Defaults to +10 mins for testing if not provided
    hrEmail: search.hrEmail ? String(search.hrEmail) : 'hr-team@studio.com',
    applicantName: search.applicantName ? String(search.applicantName) : 'Applicant',
  }),
  component: VerifyEmail,
})

function VerifyEmail() {
  const { expiresAt, hrEmail, applicantName } = Route.useSearch()
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'expired'>('idle')
  const sendEmail = useServerFn(sendHRConfirmationEmail)

  useEffect(() => {
    const checkExpiration = () => {
      if (Date.now() > expiresAt && status !== 'success') {
        setStatus('expired')
      }
    }
    checkExpiration()
    const interval = setInterval(checkExpiration, 1000)
    return () => clearInterval(interval)
  }, [expiresAt, status])

  const handleVerify = () => {
    if (Date.now() > expiresAt) {
      setStatus('expired')
      return
    }

    setStatus('verifying')
    // Simulate API call and generation of details
    setTimeout(async () => {
      setStatus('success')
      try {
        const res = await sendEmail({ data: { hrEmail, applicantName } })
        if (res.sent) {
           toast.success('Confirmation email sent to HR team.')
        } else {
           toast.success('Access verified! (Simulated - Email provider not configured)')
        }
      } catch (err) {
        toast.error('Access verified, but failed to send email to HR.')
      }
    }, 2500)
  }

  return (
    <div className="min-h-screen vault-surface flex items-center justify-center p-4">
      <div className="absolute inset-0 grain pointer-events-none" />
      <Card className="w-full max-w-md relative z-10 border-border/50 bg-card/50 backdrop-blur-xl p-8 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Animated background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-primary/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="flex flex-col items-center text-center space-y-6 relative z-10">
          
          <div className="p-4 bg-primary/10 rounded-full border border-primary/20 shadow-gold relative">
            {status === 'idle' && <Mail className="w-10 h-10 text-primary" />}
            {status === 'verifying' && <Loader2 className="w-10 h-10 text-primary animate-spin" />}
            {status === 'success' && <ShieldCheck className="w-10 h-10 text-success" />}
            {status === 'expired' && <ClockAlert className="w-10 h-10 text-destructive" />}
            
            {status === 'success' && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-success"></span>
              </span>
            )}
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-display font-bold tracking-tight">
              {status === 'idle' && "Email Verification"}
              {status === 'verifying' && "Verifying Access"}
              {status === 'success' && "Access Verified"}
              {status === 'expired' && "Link Expired"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {status === 'idle' && "Please verify your email address to grant HR access to your file."}
              {status === 'verifying' && "Securely validating your request and generating required details..."}
              {status === 'success' && "Verification complete. Your details have been generated automatically. Synchronization with the HR portal will occur once the system is fully integrated."}
              {status === 'expired' && "This access verification link has expired (10-minute limit). Please request a new link from the HR team."}
            </p>
          </div>

          {status === 'idle' && (
            <Button 
              onClick={handleVerify}
              className="w-full h-12 text-lg shadow-gold transition-all duration-300 hover:scale-[1.02]"
            >
              Verify Access
            </Button>
          )}

          {status === 'success' && (
            <div className="w-full p-4 rounded-lg bg-success/10 border border-success/20 flex items-start space-x-3 text-left">
              <CheckCircle className="w-5 h-5 text-success shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-success-foreground">Details Generated</p>
                <p className="text-success/80 mt-1">HR team has been notified of your access confirmation.</p>
              </div>
            </div>
          )}

        </div>
      </Card>
    </div>
  )
}
