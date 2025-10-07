update:
	@echo "${update_MSG}"
	@git add .
	@git commit -m "update beta"
	@git push
	@echo "✨ Mise à jour terminée✨"