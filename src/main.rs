#![allow(non_snake_case)]

use dioxus::prelude::*;
use chrono::Local;
use gloo_timers::future::TimeoutFuture;

fn main() {
    dioxus::launch(App);
}

#[component]
fn App() -> Element {
    rsx! {
        document::Stylesheet { href: asset!("/assets/style.css") }
        Clock {}
    }
}

#[component]
fn Clock() -> Element {
    let mut clock = use_signal(|| String::new());
    use_future(move || async move {
        loop {
            clock.set(Local::now().format("%H:%M").to_string());
            TimeoutFuture::new(200).await;
        }
    });

    rsx! {
        div {
            id: "clock",
            { clock }
        }
    }
}
