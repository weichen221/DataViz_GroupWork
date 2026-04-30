import pageMarkup from './page.html?raw';

export default function App() {
  return <div dangerouslySetInnerHTML={{ __html: pageMarkup }} />;
}