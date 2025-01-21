import React from "react";
import ReactDOM from "react-dom";
import IRealitio from "./containers/realitio";

const App = () => (
  <>
    <IRealitio />
  </>
);

const render = () => {
  ReactDOM.render(<App />, document.getElementById("root"));
};

render(App);

if (module.hot) {
  module.hot.accept(App, () => {
    render(App);
  });
}
