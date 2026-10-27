import { useLocation } from 'react-router-dom'
import ArticlePage from './ArticlePage'
export default function ArticleRoute() { const { pathname } = useLocation(); return <ArticlePage path={pathname.replace(/\/$/, '')} /> }
