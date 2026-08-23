import { useSearchParams, useNavigate } from 'react-router-dom'
import { QuickCaseForm } from './QuickCaseForm'
import { CaseWizard } from './CaseWizard'

/**
 * Routes to the correct create-case flow based on ?mode= query param.
 * mode=quick  → QuickCaseForm
 * mode=wizard → CaseWizard
 * (default)   → QuickCaseForm
 */
export function CreateCasePage() {
  const [params] = useSearchParams()
  const mode = params.get('mode') ?? 'quick'

  if (mode === 'wizard') return <CaseWizard />
  return <QuickCaseForm />
}
