export default class ExampleView {
  render(message) {
    const el = document.createElement('div');
    el.innerText = message;
    return el;
  }
} 