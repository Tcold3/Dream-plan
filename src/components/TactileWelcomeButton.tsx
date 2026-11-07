import './tactile-button.css';

export function TactileWelcomeButton({ onClick }: { onClick: () => void }) {
  return <button className="tactile-button welcome-trigger" type="button" onClick={onClick}>
    <span className="button-outer"><span className="button-inner"><span>欢迎回到梦开始的地方</span></span></span>
  </button>;
}
