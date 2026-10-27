import { useParams } from 'react-router-dom'
import ModulePage from './ModulePage'
export default function ModuleRoute() { const { slug = '' } = useParams(); return <ModulePage slug={slug} /> }
