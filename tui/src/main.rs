use std::io::{self};
use crossterm::{event, terminal, ExecutableCommand};
use ratatui::{prelude::*, widgets::*};

fn main() -> Result<(), io::Error> {
    let mut stdout = io::stdout();
    terminal::enable_raw_mode()?;
    stdout.execute(terminal::EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    loop {
        terminal.draw(|f| {
            let size = f.size();
            let block = Block::default()
                .title("FazAI Dashboard")
                .borders(Borders::ALL);
            f.render_widget(block, size);
        })?;

        if event::poll(std::time::Duration::from_millis(50))? {
            if let event::Event::Key(key) = event::read()? {
                if key.code == event::KeyCode::Char('q') {
                    break;
                }
            }
        }
    }

    terminal::disable_raw_mode()?;
    terminal.show_cursor()?;
    Ok(())
}
