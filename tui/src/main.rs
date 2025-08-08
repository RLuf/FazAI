use std::io::{self};
use crossterm::{event, terminal, ExecutableCommand};
use ratatui::{prelude::*, widgets::*};

const ASCII_FACE: &str = r#"
  .-"""-.._
 /          `-.
|  .-.  .-.    \
|  | |  | |     |
|  |_|  |_|     |
|   __  __      |
|  (  \\  )     |
|   `.__.`      |
|    |  |       |
|    |  |       |
|    |  |       |
|____|__|_______|

   _____        _        _ 
  |  ___|__  __| | __ _ (_)
  | |_ / _ \\/ _` |/ _` || |
  |  _|  __/ (_| | (_| || |
  |_|  \\___|\\__,_|\\__,_|/ 
                        |__/ 

  FazAI
  Roger Luft, Andarilho dos Véus - 2025
"#;

fn main() -> Result<(), io::Error> {
    let mut stdout = io::stdout();
    terminal::enable_raw_mode()?;
    stdout.execute(terminal::EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    loop {
        terminal.draw(|f| {
            let size = f.size();
            let chunks = Layout::default()
                .direction(Direction::Vertical)
                .margin(1)
                .constraints([
                    Constraint::Length(20),
                    Constraint::Min(5),
                    Constraint::Length(1),
                ]).split(size);

            let header = Paragraph::new(ASCII_FACE)
                .block(Block::default().borders(Borders::ALL).title("FazAI"));
            f.render_widget(header, chunks[0]);

            let help = Paragraph::new("[q] sair  [l] logs  [s] status  [m] métricas")
                .block(Block::default().borders(Borders::ALL).title("Atalhos"));
            f.render_widget(help, chunks[2]);
        })?;

        if event::poll(std::time::Duration::from_millis(100))? {
            if let event::Event::Key(key) = event::read()? {
                match key.code {
                    event::KeyCode::Char('q') => break,
                    _ => {}
                }
            }
        }
    }

    terminal::disable_raw_mode()?;
    terminal.show_cursor()?;
    Ok(())
}
