package cmd

import (
	"fmt"
	"log/slog"
	"os"

	"github.com/spf13/cobra"
)

var (
	noBanner bool
	verbose  bool
	version  = "1.1.0"
)

var rootCmd = &cobra.Command{
	Use:     "beacon",
	Version: version,
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
		slog.SetDefault(logger)
		slog.SetLogLoggerLevel(slog.LevelInfo)

		if verbose {
			slog.SetLogLoggerLevel(slog.LevelDebug)
		}
	},
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "Verbose logging")
}
