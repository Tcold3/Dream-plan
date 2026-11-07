import './tactile-button.css';

export function TactileWelcomeButton({ onClick }: { onClick: () => void }) {
  return <button className="tactile-button welcome-trigger" type="button" onClick={onClick}>
    <span className="button-outer"><span className="button-inner"><span>欢迎来到音乐纪元</span></span></span>
  </button>;
}
