package server

import (
	"fmt"

	"github.com/charmbracelet/lipgloss"
)

var (
	logTitle = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("69"))
	logNote  = lipgloss.NewStyle().Italic(true).Foreground(lipgloss.Color("244"))
	logOK    = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("42"))
	logWarn  = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("214"))
	logPath  = lipgloss.NewStyle().Underline(true).Foreground(lipgloss.Color("75"))
	logMeth  = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("205"))
)

func StyledServerRunning(addr string) string {
	return fmt.Sprintf("%s %s", logOK.Render("Server is running at"), logPath.Render(addr))
}

func StyledServerStopping() string {
	return logWarn.Render("Shutting down server...")
}

func StyledServerStopped() string {
	return logOK.Render("Server gracefully stopped")
}

func StyledRequest(method, path string) string {
	return fmt.Sprintf("%s %s", logMeth.Render(method), logPath.Render(path))
}
