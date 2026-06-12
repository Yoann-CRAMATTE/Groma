import sys
from PySide6.QtWidgets import QApplication, QMainWindow, QWidget
from PySide6.QtGui import QPainter, QPen, QColor
from PySide6.QtCore import Qt, QPoint


class Canvas(QWidget):
    def __init__(self):
        super().__init__()
        self.setFixedSize(640, 480)
        self.setStyleSheet("background-color: white;")
        self._lines = []
        self._current_color = QColor("#000000")

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        for line in self._lines:
            pen = QPen(QColor(line["color"]), line["width"], Qt.SolidLine)
            painter.setPen(pen)
            painter.drawLine(
                QPoint(line["x1"], line["y1"]),
                QPoint(line["x2"], line["y2"]),
            )

    # --- Actions du manifeste ---

    def action_new_canvas(self, params: dict):
        self._lines.clear()
        self.update()

    def action_set_color(self, params: dict):
        self._current_color = QColor(params.get("color", "#000000"))

    def action_draw_line(self, params: dict):
        self._lines.append({
            "x1": params.get("x1", 0),
            "y1": params.get("y1", 0),
            "x2": params.get("x2", 100),
            "y2": params.get("y2", 100),
            "color": params.get("color", self._current_color.name()),
            "width": params.get("width", 2),
        })
        self.update()

    def dispatch(self, action: dict):
        """Point d'entrée unique pour toutes les actions manifeste."""
        handler = getattr(self, f"action_{action['action']}", None)
        if handler:
            handler(action.get("params", {}))


class PaintWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Paint · Synapse")
        self.canvas = Canvas()
        self.setCentralWidget(self.canvas)


def launch() -> tuple[QApplication, PaintWindow]:
    app = QApplication.instance() or QApplication(sys.argv)
    window = PaintWindow()
    window.show()
    return app, window


if __name__ == "__main__":
    app, window = launch()
    sys.exit(app.exec())
